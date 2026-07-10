import type { ScoreAggregate, ScoreProgress, SystemScoreEntry } from '@/types'

/**
 * Merge the score rows from several data calls into one map keyed by
 * fismasystemid. A system belongs to exactly one call per year, so the keys
 * are disjoint across calls and there is no meaningful collision; if one ever
 * occurred, the later call wins. Pure so the aggregation is unit-testable.
 * @param {ScoreAggregate[][]} rowsPerCall - Aggregate rows, one array per call.
 * @returns {Record<number, SystemScoreEntry>} Score entry per system.
 */
export function buildScoreMap(
  rowsPerCall: ScoreAggregate[][]
): Record<number, SystemScoreEntry> {
  const map: Record<number, SystemScoreEntry> = {}
  for (const rows of rowsPerCall) {
    for (const row of rows) {
      map[row.fismasystemid] = {
        score: row.systemscore ?? 0,
        tier: row.systemtier,
      }
    }
  }
  return map
}

/**
 * Merge the progress rows from several data calls into one map keyed by
 * fismasystemid (disjoint keys, later call wins on any collision).
 * @param {ScoreProgress[][]} rowsPerCall - Progress rows, one array per call.
 * @returns {Record<number, ScoreProgress>} Progress per system.
 */
export function buildProgressMap(
  rowsPerCall: ScoreProgress[][]
): Record<number, ScoreProgress> {
  const map: Record<number, ScoreProgress> = {}
  for (const rows of rowsPerCall) {
    for (const row of rows) {
      map[row.fismasystemid] = row
    }
  }
  return map
}

/**
 * Record which data call(s) each system has scores in across the active calls.
 * Normally a system is in exactly one call per year, so this lets a per-row
 * action open that system's own call. A system in more than one active call is
 * genuinely ambiguous and its single-call actions should be gated.
 * @param {ScoreAggregate[][]} rowsPerCall - Aggregate rows, one array per call.
 * @returns {Record<number, number[]>} Distinct datacallids per system.
 */
export function buildSystemCallMap(
  rowsPerCall: ScoreAggregate[][]
): Record<number, number[]> {
  const map: Record<number, number[]> = {}
  for (const rows of rowsPerCall) {
    for (const row of rows) {
      const list = map[row.fismasystemid] ?? (map[row.fismasystemid] = [])
      if (!list.includes(row.datacallid)) list.push(row.datacallid)
    }
  }
  return map
}
