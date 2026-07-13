import type { ScoreAggregate, ScoreProgress, SystemScoreEntry } from '@/types'

export type DashboardMaps = {
  scoreMap: Record<number, SystemScoreEntry>
  progressMap: Record<number, ScoreProgress>
  /** Which active data call(s) each system has scores in, for per-row actions. */
  systemCallMap: Record<number, number[]>
  /** The single call chosen for each system's dashboard row (most-recently-updated). */
  chosenCallMap: Record<number, number>
}

const lastUpdatedMs = (entry: ScoreProgress | undefined): number => {
  if (!entry?.lastupdatedat) return -1
  const t = new Date(entry.lastupdatedat).getTime()
  return Number.isNaN(t) ? -1 : t
}

/**
 * Build the dashboard's score, progress, and system→calls maps from the active
 * data calls, aggregated per system.
 *
 * A system can appear in more than one of a year's calls (e.g. an annual ZTM
 * call and a Q# call). We display the call the system **most recently updated**
 * (max `lastupdatedat`), so a system that completed one call is shown as such
 * rather than as 0 against a newer call it never touched. A system that never
 * updated any call falls back to the newest call available. Score and progress
 * are taken from that same chosen call so they stay consistent.
 *
 * Inputs are aligned by index and ordered newest-call-first, which is both the
 * tiebreak for the fallback and the order `callIds` is passed in.
 * @param {number[]} callIds - Active data-call ids, newest first.
 * @param {ScoreAggregate[][]} scoresPerCall - Aggregate rows, aligned to callIds.
 * @param {ScoreProgress[][]} progressPerCall - Progress rows, aligned to callIds.
 * @returns {DashboardMaps} The per-system score, progress, and call maps.
 */
export function buildDashboardMaps(
  callIds: number[],
  scoresPerCall: ScoreAggregate[][],
  progressPerCall: ScoreProgress[][]
): DashboardMaps {
  // Per-call lookups keyed by system for O(1) access.
  const scoreByCall = scoresPerCall.map((rows) => {
    const m = new Map<number, ScoreAggregate>()
    for (const row of rows) m.set(row.fismasystemid, row)
    return m
  })
  const progressByCall = progressPerCall.map((rows) => {
    const m = new Map<number, ScoreProgress>()
    for (const row of rows) m.set(row.fismasystemid, row)
    return m
  })

  // The call indices each system appears in (scores drive the table), newest
  // first since callIds is newest first.
  const systemIdxs = new Map<number, number[]>()
  scoreByCall.forEach((m, idx) => {
    for (const sys of m.keys()) {
      const arr = systemIdxs.get(sys)
      if (arr) arr.push(idx)
      else systemIdxs.set(sys, [idx])
    }
  })

  const scoreMap: Record<number, SystemScoreEntry> = {}
  const progressMap: Record<number, ScoreProgress> = {}
  const systemCallMap: Record<number, number[]> = {}
  const chosenCallMap: Record<number, number> = {}

  for (const [sys, idxs] of systemIdxs) {
    // Choose the call this system most recently updated; ties and
    // never-updated systems keep the newest call (idxs[0]).
    let chosen = idxs[0]
    let bestT = lastUpdatedMs(progressByCall[chosen]?.get(sys))
    for (const idx of idxs) {
      const t = lastUpdatedMs(progressByCall[idx]?.get(sys))
      if (t > bestT) {
        bestT = t
        chosen = idx
      }
    }

    const score = scoreByCall[chosen]?.get(sys)
    if (score) {
      scoreMap[sys] = { score: score.systemscore ?? 0, tier: score.systemtier }
    }
    const progress = progressByCall[chosen]?.get(sys)
    if (progress) progressMap[sys] = progress
    systemCallMap[sys] = idxs.map((idx) => callIds[idx])
    chosenCallMap[sys] = callIds[chosen]
  }

  return { scoreMap, progressMap, systemCallMap, chosenCallMap }
}
