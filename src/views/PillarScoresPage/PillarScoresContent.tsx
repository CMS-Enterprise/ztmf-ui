import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { ScoreAggregate, datacall } from '@/types'
import { colors } from '@/theme/tokens'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import HeroRow from './components/HeroRow'
import PillarGrid from './components/PillarGrid'
import QuestionBreakdown from './QuestionBreakdown'

/** Props for {@link PillarScoresContent}. */
export interface PillarScoresContentProps {
  /** Score aggregates for the system across one or more datacalls. */
  scores: ScoreAggregate[]
  /** The datacall to show as the current period. */
  selectedDataCallId: number
  /** Stable system id, for the question-level breakdown fetch. */
  fismasystemid: number
  /** Human-readable name of the current datacall, shown in the hero stats. */
  currentDatacallName?: string
  /** Human-readable name of the previous datacall, used in the trend line. */
  previousDatacallName?: string
  /**
   * Datacall id to use as the trend baseline. Overrides the implicit
   * "most recent prior datacall on this system" lookup; lets the parent
   * page tie the trend to the user's pick from the Compare Datacalls
   * modal. Falls back to the implicit lookup when undefined.
   */
  comparisonFromDatacallId?: number
  /**
   * Data-call reference list. When present, the latest/previous fallbacks
   * order by deadline (the real "newest" - historical loads can carry a
   * higher datacallid than the current call); id order is the fallback
   * when the list is absent.
   */
  datacalls?: datacall[]
}

/**
 * Pillar Scores page body. Renders the two-card hero, the pillar grid, and
 * the question-level breakdown. This is an orchestrator only - the
 * presentational pieces live under ./components/ and the question-level
 * join lives in ./useQuestionBreakdown.ts. Three deliberate omissions
 * vs the visual mock, each driven by the locked plan:
 *
 *  - the "Comparison vs OpDiv average" radar is replaced with this system's
 *    "Current vs Previous" history radar (no OpDiv-average endpoint exists
 *    and the audit forbids fabricated comparators);
 *  - the per-question "Δ FY22" column is dropped (the plan locks "no
 *    per-question delta columns");
 *  - the "Cross-cutting" stat in the hero is omitted (ambiguous semantics).
 *
 * @param {PillarScoresContentProps} props - Component props.
 * @returns {JSX.Element} The pillar scores content block.
 */
export default function PillarScoresContent({
  scores,
  selectedDataCallId,
  fismasystemid,
  currentDatacallName,
  previousDatacallName,
  comparisonFromDatacallId,
  datacalls,
}: PillarScoresContentProps) {
  // Score datacallids ordered newest-first. Deadline order via the shared
  // datacalls list when available (the real "newest" - historical loads can
  // carry a higher datacallid than the current call); id order otherwise.
  const orderedCallIds = useMemo(() => {
    const present = new Set(scores.map((s) => s.datacallid))
    if (datacalls && datacalls.length > 0) {
      const ordered = sortDatacallsByDeadline(
        datacalls.filter((d) => present.has(d.datacallid))
      ).map((d) => d.datacallid)
      // Score rows whose call is missing from the reference list still
      // participate, after the known ones, in id order.
      const known = new Set(ordered)
      const unknown = [...present]
        .filter((id) => !known.has(id))
        .sort((a, b) => b - a)
      return [...ordered, ...unknown]
    }
    return [...present].sort((a, b) => b - a)
  }, [scores, datacalls])

  // Latest score = the selected datacall if it has data, otherwise the
  // newest call (by deadline) in the set. Lets the page still render the
  // most recent measurement when no datacall is picked yet.
  const latestScore =
    scores.length > 0
      ? scores.find((s) => s.datacallid === selectedDataCallId) ??
        scores.find((s) => s.datacallid === orderedCallIds[0]) ??
        scores[0]
      : null

  // Previous-score lookup respects the parent's explicit comparison pick
  // (driven by the Compare Datacalls modal) and falls back to the next
  // older call (deadline order) on this system when nothing's been picked.
  const previousScore = useMemo(() => {
    if (!latestScore) return undefined
    if (typeof comparisonFromDatacallId === 'number') {
      return scores.find((s) => s.datacallid === comparisonFromDatacallId)
    }
    const idx = orderedCallIds.indexOf(latestScore.datacallid)
    const prevId = idx >= 0 ? orderedCallIds[idx + 1] : undefined
    return prevId != null
      ? scores.find((s) => s.datacallid === prevId)
      : undefined
  }, [scores, latestScore, comparisonFromDatacallId, orderedCallIds])

  const hasValidData = Boolean(
    latestScore &&
      latestScore.pillarscores &&
      latestScore.pillarscores.length > 0
  )

  if (!latestScore || !hasValidData) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 15, fontWeight: 700, color: colors.ink, mb: 1 }}
        >
          No score data available
        </Typography>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          This system does not have any scoring data yet. Check back after the
          next datacall closes.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <HeroRow
        latestScore={latestScore}
        previousScore={previousScore}
        currentDatacallName={currentDatacallName}
        previousDatacallName={previousDatacallName}
        scores={scores}
      />
      <PillarGrid latestScore={latestScore} previousScore={previousScore} />
      <QuestionBreakdown
        fismasystemid={fismasystemid}
        datacallid={latestScore.datacallid}
      />
    </Box>
  )
}
