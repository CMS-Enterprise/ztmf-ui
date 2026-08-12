/**
 * Sorting and formatting logic for the user grid's "Last seen" column,
 * extracted so it can be tested without standing up the grid.
 *
 * The column is deliberately labeled "Last seen", not "Last login": activity
 * tracking began 2026-08-06, so a null for an older account means "no recorded
 * activity since tracking began", not "never signed in".
 */
import type {
  GridComparatorFn,
  GridFilterModel,
  GridSortItem,
} from '@mui/x-data-grid'

/** Neutral empty state - see the module note on why it isn't "Never logged in". */
export const LAST_SEEN_EMPTY_LABEL = 'No activity recorded'

/** The filter item the "No Activity Only" toolbar switch injects. */
export const NO_ACTIVITY_FILTER_ITEM = {
  id: 'no-activity',
  field: 'last_seen',
  operator: 'isEmpty',
}

/** Whether the model currently carries the no-activity filter (drives the switch). */
export function hasNoActivityFilter(model: GridFilterModel): boolean {
  return model.items.some(
    (item) => item.field === 'last_seen' && item.operator === 'isEmpty'
  )
}

/**
 * Toggle the no-activity filter on a filter model. The community DataGrid
 * allows only ONE column-filter item (disableMultipleColumnsFiltering is
 * hard-set); sanitizeFilterModel drops anything past the first and logs a
 * console error. So switching ON must REPLACE the items array outright, not
 * append - an appended item at index 1 would be silently discarded whenever
 * the user already had a filter applied via the column filter panel. The
 * spread preserves quickFilterValues, which live beside items and are not
 * subject to the single-item limit.
 */
export function withNoActivityFilter(
  model: GridFilterModel,
  on: boolean
): GridFilterModel {
  return {
    ...model,
    items: on
      ? [NO_ACTIVITY_FILTER_ITEM]
      : model.items.filter(
          (item) => !(item.field === 'last_seen' && item.operator === 'isEmpty')
        ),
  }
}

/** Parse an ISO timestamp defensively; null for missing or unparseable input. */
export function parseLastSeen(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/**
 * Relative rendering for the cell ("3 days ago"). Anything under a minute -
 * including a slightly-ahead server clock - reads "just now".
 */
export function formatLastSeenRelative(value: Date, now: Date): string {
  const diffSec = Math.round((now.getTime() - value.getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always' })
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (diffSec >= seconds) {
      return rtf.format(-Math.floor(diffSec / seconds), unit)
    }
  }
  return 'just now'
}

/** Absolute timestamp for the hover tooltip, in the viewer's locale. */
export function formatLastSeenAbsolute(value: Date): string {
  return value.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Comparator for the column, direction-aware so never-active rows sort LAST in
 * both directions. The grid negates the comparator's result when sorting desc,
 * so the null branches pre-compensate: returning -1 for a null under desc
 * becomes +1 after negation, keeping the null at the bottom.
 */
export function compareLastSeen(
  a: Date | null | undefined,
  b: Date | null | undefined,
  direction: 'asc' | 'desc'
): number {
  const aNull = a == null
  const bNull = b == null
  if (aNull && bNull) return 0
  if (aNull) return direction === 'desc' ? -1 : 1
  if (bNull) return direction === 'desc' ? 1 : -1
  return a.getTime() - b.getTime()
}

/**
 * The column's comparator: reads the LIVE sort direction off the grid api at
 * compare time (v6 commits the new sort model to state before applying the
 * sort, so this sees the direction being applied, not the previous one) and
 * hands it to compareLastSeen. Exported so the grid-level test can exercise
 * this exact wiring - the getSortModel() read is the fragile part, not the
 * pure comparison.
 *
 * TODO(x-data-grid v7): replace with getSortComparator(direction) on the
 * column def and drop the direction plumbing here - a v7 upgrade that keeps
 * this workaround would still work, but the native hook is the intended API.
 */
export const lastSeenSortComparator: GridComparatorFn<Date | null> = (
  v1,
  v2,
  cellParams1
) => {
  const direction = (cellParams1.api.getSortModel() as GridSortItem[]).find(
    (item) => item.field === cellParams1.field
  )?.sort
  return compareLastSeen(v1, v2, direction === 'desc' ? 'desc' : 'asc')
}
