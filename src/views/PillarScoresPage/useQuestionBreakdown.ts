import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import { isAuthHandled } from '@/utils/notify'
import { tierForScore } from '@/utils/tierStyles'
import { PILLAR_ORDER } from '@/constants'
import type { FismaQuestion, ScoreTier } from '@/types'

/**
 * Shape of a /scores row when fetched with ?include=functionoption.
 *
 * The Score row itself only carries `functionoptionid`. The joined
 * `functionoption` brings back the picked option's numeric score (1-4) and
 * its parent `functionid`, which is what we need to join back to a question
 * (each question has one function via /fismasystems/{id}/questions).
 */
export interface QuestionScoreRow {
  scoreid: number
  functionoptionid: number
  functionoption?: {
    functionoptionid: number
    functionid: number
    score: number
    optionname: string
    description: string
  }
}

/**
 * Joined view-model for a single row of the question-level breakdown.
 *
 * `displayScore` is on the user-facing 1-5 scale: per-option raw scores from
 * the backend live on a 0-4 scale, and the aggregation applies a +1 shift to
 * land on 1-5. The breakdown table displays a per-question (per-option)
 * score, so we apply the same shift here so the row tiers visually agree
 * with the pillar grid above (also on 1-5 from the aggregate endpoint).
 */
export interface QuestionBreakdownRow {
  scoreid: number
  questionid: number
  question: string
  pillar: string
  functionName: string
  displayScore: number
  tier: ScoreTier
}

/** Stable sort: known pillars first, in PILLAR_ORDER. */
function pillarRank(name: string | undefined): number {
  if (!name) return Number.MAX_SAFE_INTEGER
  const i = PILLAR_ORDER.indexOf(name)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

/**
 * Loads the per-question breakdown for a single (system, datacall) pair and
 * returns the joined rows ready to render.
 *
 * Two endpoints feed this:
 *
 *   1. /fismasystems/{id}/questions  — question text + pillar + function
 *      name, keyed by functionid (each question has exactly one function).
 *   2. /scores?datacallid=...&fismasystemid=...&include=functionoption — the
 *      picked option per question, carrying functionid + the raw 0-4 score.
 *
 * Rows are joined on functionid, the score is shifted (+1) onto the 1-5
 * scale the rest of the page uses, the tier is derived from that shifted
 * value via {@link tierForScore}, and the result is stably sorted by
 * pillar order then function name. The list endpoint may return a stale
 * score for a function that has since been removed; those rows are dropped
 * defensively.
 *
 * @param {number} fismasystemid - The system whose breakdown to load.
 * @param {number} datacallid - The datacall to scope the score fetch to.
 * @returns {{ rows: QuestionBreakdownRow[], loading: boolean,
 *   pillarOptions: string[] }} Joined rows, a loading flag, and the set of
 *   pillar names actually present in the rows (for a filter dropdown).
 */
export function useQuestionBreakdown(
  fismasystemid: number,
  datacallid: number
): {
  rows: QuestionBreakdownRow[]
  loading: boolean
  pillarOptions: string[]
} {
  const [questions, setQuestions] = useState<FismaQuestion[]>([])
  const [scores, setScores] = useState<QuestionScoreRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!fismasystemid || !datacallid) return
    const controller = new AbortController()
    setLoading(true)
    async function load() {
      try {
        const [questionsRes, scoresRes] = await Promise.all([
          axiosInstance.get(`/fismasystems/${fismasystemid}/questions`, {
            signal: controller.signal,
          }),
          axiosInstance.get(
            `scores?datacallid=${datacallid}&fismasystemid=${fismasystemid}&include=functionoption`,
            { signal: controller.signal }
          ),
        ])
        setQuestions(questionsRes.data?.data ?? [])
        setScores(scoresRes.data?.data ?? [])
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Failed to load question breakdown', error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => {
      controller.abort()
    }
  }, [fismasystemid, datacallid])

  // Index questions by functionid so the score join is O(1) per row. Each
  // question is associated with exactly one function on the backend.
  const questionByFunctionId = useMemo(() => {
    const map = new Map<
      number,
      {
        questionid: number
        question: string
        pillar: string
        functionName: string
      }
    >()
    for (const q of questions) {
      if (q.function?.functionid != null) {
        map.set(q.function.functionid, {
          questionid: q.questionid,
          question: q.question,
          pillar: q.pillar?.pillar ?? '-',
          functionName: q.function.function,
        })
      }
    }
    return map
  }, [questions])

  const rows: QuestionBreakdownRow[] = useMemo(() => {
    const out: QuestionBreakdownRow[] = []
    for (const s of scores) {
      const fid = s.functionoption?.functionid
      if (fid == null) continue
      const q = questionByFunctionId.get(fid)
      if (!q) continue
      const rawScore = s.functionoption?.score ?? 0
      const displayScore = rawScore + 1
      out.push({
        scoreid: s.scoreid,
        questionid: q.questionid,
        question: q.question,
        pillar: q.pillar,
        functionName: q.functionName,
        displayScore,
        tier: tierForScore(displayScore),
      })
    }
    return out.sort((a, b) => {
      const pr = pillarRank(a.pillar) - pillarRank(b.pillar)
      if (pr !== 0) return pr
      return a.functionName.localeCompare(b.functionName)
    })
  }, [scores, questionByFunctionId])

  const pillarOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.pillar)
    return Array.from(set).sort((a, b) => pillarRank(a) - pillarRank(b))
  }, [rows])

  return { rows, loading, pillarOptions }
}
