import type { FismaSystemType, ScoreProgress } from '@/types'
import { progressSortValue } from './progressHelpers'

/**
 * Client-side dashboard filter selections. Each facet is independent and
 * combines with the others via AND; an empty/false facet is a no-op.
 */
export type DashboardFilterState = {
  /** Selected Environment *category* labels (resolved from datacenterenvironment). */
  environments: string[]
  /** Selected opdiv_id values. */
  opdivIds: number[]
  /** When true, keep only systems that have a questionnaire but zero updates. */
  notUpdatedOnly: boolean
}

/** An empty filter state — nothing selected, everything passes. */
export const EMPTY_DASHBOARD_FILTERS: DashboardFilterState = {
  environments: [],
  opdivIds: [],
  notUpdatedOnly: false,
}

/**
 * True when no facet is active, so filtering can be skipped entirely.
 * @param {DashboardFilterState} filters - The current selections.
 * @returns {boolean} True when every facet is empty/false.
 */
export function hasNoActiveFilters(filters: DashboardFilterState): boolean {
  return (
    filters.environments.length === 0 &&
    filters.opdivIds.length === 0 &&
    !filters.notUpdatedOnly
  )
}

/**
 * True when a system is a genuine "Not updated" laggard for the active data
 * call: it has a questionnaire but zero functions updated. Reuses the column's
 * own classifier (`progressSortValue === -1`) so the filter and the Data Call
 * Progress chip never disagree — the 0/0 "N/A" case and systems with no
 * progress data are intentionally excluded.
 *
 * "Not updated" is a current-cycle laggard signal, so it only applies to the
 * current/active call: a past call reads 0 updates for everyone (ztmf#537) and
 * has no laggards to surface. A row on a past call is never a laggard.
 * @param {ScoreProgress | undefined} entry - The system's progress row.
 * @param {boolean} [isCurrentCall=true] - Whether the row's displayed call is
 *   the current/active one. Defaults true so callers without call context keep
 *   the original behavior.
 * @returns {boolean} True when the system is not updated but has a questionnaire.
 */
export function isNotUpdated(
  entry: ScoreProgress | undefined,
  isCurrentCall: boolean = true
): boolean {
  if (!isCurrentCall) return false
  return progressSortValue(entry) === -1
}

/**
 * Apply the dashboard filters to the system rows. Pure and side-effect free so
 * it can be memoized in the component and unit-tested in isolation (the
 * repo's established pattern for grid logic).
 * @param {FismaSystemType[]} rows - All system rows currently in the grid.
 * @param {Record<number, ScoreProgress>} progress - Progress keyed by fismasystemid.
 * @param {Record<string, string>} categoryMap - Raw datacenterenvironment -> category.
 * @param {DashboardFilterState} filters - The active selections.
 * @param {(fismasystemid: number) => boolean} [isCurrentCall] - Whether a row's
 *   displayed call is the current/active one. The "Not updated" facet only
 *   matches current-call laggards (ztmf#537); defaults to treating every row as
 *   current so callers without call context keep the original behavior.
 * @returns {FismaSystemType[]} The subset of rows passing every active facet.
 */
export function applyDashboardFilters(
  rows: FismaSystemType[],
  progress: Record<number, ScoreProgress>,
  categoryMap: Record<string, string>,
  filters: DashboardFilterState,
  isCurrentCall: (fismasystemid: number) => boolean = () => true
): FismaSystemType[] {
  if (hasNoActiveFilters(filters)) return rows

  const envSet = new Set(filters.environments)
  const opdivSet = new Set(filters.opdivIds)

  return rows.filter((row) => {
    if (envSet.size > 0) {
      const category = categoryMap[row.datacenterenvironment]
      if (!category || !envSet.has(category)) return false
    }
    if (opdivSet.size > 0) {
      if (row.opdiv_id == null || !opdivSet.has(row.opdiv_id)) return false
    }
    if (
      filters.notUpdatedOnly &&
      !isNotUpdated(
        progress[row.fismasystemid],
        isCurrentCall(row.fismasystemid)
      )
    ) {
      return false
    }
    return true
  })
}
