/**
 * Per-OpDiv rollup, for the aggregate view.
 *
 * The one figure the aggregate can show that a single-OpDiv page cannot:
 * which OpDivs are carrying the department and which are behind. Built from
 * rows already on the client, so it costs nothing beyond the page's own data.
 *
 * @module views/OpDivDashboard/opdivByOpDiv
 */
import { tierForScore } from '@/utils/tierStyles'
import type { OpDiv, ScoreTier } from '@/types'
import type { OpDivSystemRow } from './opdivAggregates'

/** One OpDiv's standing within the aggregate. */
export type OpDivAverage = {
  opdivId: number
  code: string
  /** Null when the OpDiv has systems but none of them are scored. */
  avg: number | null
  /** Band the average falls in. Null alongside a null average. */
  tier: ScoreTier | null
  /** Systems contributing to the average. */
  scored: number
  /** Active systems in the OpDiv, scored or not. */
  systems: number
}

/** Code shown for a system whose OpDiv is not in the catalog. */
const UNKNOWN_CODE = 'Unassigned'

/**
 * Averages each OpDiv's scored systems.
 *
 * Systems whose OpDiv is missing from the catalog are grouped rather than
 * dropped: they are real systems in the caller's scope, and silently omitting
 * them would make the per-OpDiv counts disagree with the page's own total.
 * @param {OpDivSystemRow[]} rows - Rows for every OpDiv in scope.
 * @param {OpDiv[]} opdivs - The OpDiv catalog, for codes.
 * @returns {OpDivAverage[]} Averages, highest first; unscored OpDivs last.
 */
export function averageByOpDiv(
  rows: OpDivSystemRow[],
  opdivs: OpDiv[]
): OpDivAverage[] {
  const codes = new Map(opdivs.map((od) => [od.opdiv_id, od.code]))
  const buckets = new Map<
    number,
    { sum: number; scored: number; systems: number }
  >()

  for (const row of rows) {
    // -1 stands in for "no OpDiv recorded" so the bucket has a stable key.
    const id = row.system.opdiv_id ?? -1
    const bucket = buckets.get(id) ?? { sum: 0, scored: 0, systems: 0 }
    bucket.systems += 1
    if (row.score !== undefined) {
      bucket.sum += row.score
      bucket.scored += 1
    }
    buckets.set(id, bucket)
  }

  return [...buckets.entries()]
    .map(([opdivId, b]) => ({
      opdivId,
      code: codes.get(opdivId) ?? UNKNOWN_CODE,
      avg: b.scored > 0 ? b.sum / b.scored : null,
      // An OpDiv average is not a graded system, so there is no API tier for
      // it - the same documented exception the hero and the pillar bars use.
      tier: b.scored > 0 ? tierForScore(b.sum / b.scored) : null,
      scored: b.scored,
      systems: b.systems,
    }))
    .sort((a, b) => {
      // Unscored OpDivs sink below scored ones rather than sorting as zero,
      // which would read as the worst performer instead of as no data.
      if (a.avg === null && b.avg === null) return a.code.localeCompare(b.code)
      if (a.avg === null) return 1
      if (b.avg === null) return -1
      return b.avg - a.avg || a.code.localeCompare(b.code)
    })
}
