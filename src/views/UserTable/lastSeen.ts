/**
 * Sorting and formatting logic for the user grid's "Last seen" column,
 * extracted so it can be tested without standing up the grid.
 *
 * The column is deliberately labeled "Last seen", not "Last login": activity
 * tracking began 2026-08-06, so a null for an older account means "no recorded
 * activity since tracking began", not "never signed in".
 */

/** Neutral empty state - see the module note on why it isn't "Never logged in". */
export const LAST_SEEN_EMPTY_LABEL = 'No activity recorded'

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
