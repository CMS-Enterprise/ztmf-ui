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

  // Two per-call, newest-first index lists (callIds is newest first):
  //   systemIdxs - union of score AND progress rows. Drives row membership,
  //     progressMap, and the rank, so a never-started system (progress row, no
  //     score) is included instead of dropped.
  //   scoreIdxs  - score rows only. Drives systemCallMap, whose consumers
  //     (export provenance, the #467 call picker in FismaTable) mean "calls this
  //     system has a real score in". Feeding them the union would list
  //     progress-only calls, disabling export and firing the picker spuriously.
  // Per call index keeps both deduped.
  const systemIdxs = new Map<number, number[]>()
  const scoreIdxs = new Map<number, number[]>()
  for (let idx = 0; idx < callIds.length; idx++) {
    const sysIds = new Set<number>()
    for (const sys of scoreByCall[idx]?.keys() ?? []) {
      sysIds.add(sys)
      const arr = scoreIdxs.get(sys)
      if (arr) arr.push(idx)
      else scoreIdxs.set(sys, [idx])
    }
    for (const sys of progressByCall[idx]?.keys() ?? []) sysIds.add(sys)
    for (const sys of sysIds) {
      const arr = systemIdxs.get(sys)
      if (arr) arr.push(idx)
      else systemIdxs.set(sys, [idx])
    }
  }

  const scoreMap: Record<number, SystemScoreEntry> = {}
  const progressMap: Record<number, ScoreProgress> = {}
  const systemCallMap: Record<number, number[]> = {}
  const chosenCallMap: Record<number, number> = {}

  for (const [sys, idxs] of systemIdxs) {
    // Choose the call this system most recently updated; ties/never-updated keep
    // the newest (idxs[0]). Break ties toward a call the system actually has a
    // score in: lastUpdatedMs returns -1 for a null OR missing progress row (a
    // failed /scores/progress fetch, or an imported call with no edit events),
    // so a scored call can tie at -1 with a never-started one. Without the
    // score-preference the newer (progress-only) call would win and the real
    // score would never land in scoreMap - the system would read as unscored.
    // The tie-break only covers the -1 tie; a scoreless call winning outright
    // (strict >) is prevented only by the backend invariant "scoreless => null
    // lastupdatedat" (edits create scores). If that ever changes - e.g. a
    // non-answer event bumps lastupdatedat - a scoreless call could out-`>` a
    // scored one and this is where the score would be blanked.
    let chosen = idxs[0]
    let bestT = -Infinity
    let bestHasScore = false
    for (const idx of idxs) {
      const t = lastUpdatedMs(progressByCall[idx]?.get(sys))
      const hasScore = scoreByCall[idx]?.has(sys) ?? false
      if (t > bestT || (t === bestT && hasScore && !bestHasScore)) {
        bestT = t
        chosen = idx
        bestHasScore = hasScore
      }
    }

    const score = scoreByCall[chosen]?.get(sys)
    if (score) {
      scoreMap[sys] = { score: score.systemscore ?? 0, tier: score.systemtier }
    }
    const progress = progressByCall[chosen]?.get(sys)
    if (progress) progressMap[sys] = progress
    // Score-derived (see scoreIdxs): a never-started system lists no calls here.
    systemCallMap[sys] = (scoreIdxs.get(sys) ?? []).map((idx) => callIds[idx])
    chosenCallMap[sys] = callIds[chosen]
  }

  return { scoreMap, progressMap, systemCallMap, chosenCallMap }
}
