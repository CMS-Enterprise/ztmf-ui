/**
 * The app's single date vocabulary (redesign decision D3).
 *
 * Two shapes, chosen by what the value means rather than by what the API
 * happens to send:
 *
 * - {@link formatDate} for a calendar day - `Sep 30, 2025`
 * - {@link formatDateTime} for a moment in time - `Sep 30, 2025, 7:00 PM`
 *
 * Both pin the locale to `en-US` so the wording is stable for every viewer.
 * Relative phrasing ("3 days ago") is deliberately not offered here; it is
 * reserved for the Users "Last seen" column, where recency is the point.
 */

/** Rendered when a value is absent or unparseable, unless a fallback is given. */
const EMPTY = '-'

/** `2025-09-30`, optionally with a time, but carrying no timezone at all. */
const ZONELESS =
  /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?$/

/** Accepted inputs: an ISO string, a Date, or nothing. */
export type DateInput = string | Date | null | undefined

/**
 * Coerce an input to a valid Date, or null.
 *
 * A string with no timezone is read as UTC rather than as the viewer's local
 * time. The API emits both `1977-05-25 00:00:00+00` and, for some CFACTS
 * fields, a bare `2026-12-13 00:00:00.000`; both mean the same instant, and
 * letting the browser guess on the second makes the rendered day depend on
 * where the viewer sits.
 */
function parse(value: DateInput): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  const zoneless = ZONELESS.exec(value)
  const parsed = zoneless
    ? new Date(`${zoneless[1]}T${zoneless[2] ?? '00:00:00'}Z`)
    : new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Format a calendar day: `Sep 30, 2025`.
 *
 * Rendered in UTC on purpose. Day-granularity columns (decommission and
 * reactivation dates, datacall deadlines, ATO expirations) reach us as UTC
 * midnight, and formatting those locally in the Americas lands on the
 * previous day - a seeded decommission of `1977-05-25 00:00:00+00` used to
 * read `5/24/1977`.
 *
 * @param value - ISO string, Date, or nothing.
 * @param fallback - Returned when the value is absent or unparseable.
 */
export function formatDate(value: DateInput, fallback = EMPTY): string {
  const parsed = parse(value)
  if (!parsed) return fallback
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Format a moment in time: `Sep 30, 2025, 7:00 PM`.
 *
 * Rendered in the viewer's timezone, which is what an audit timestamp,
 * a sync time, or a "last edited" marker should show.
 *
 * @param value - ISO string, Date, or nothing.
 * @param fallback - Returned when the value is absent or unparseable.
 */
export function formatDateTime(value: DateInput, fallback = EMPTY): string {
  const parsed = parse(value)
  if (!parsed) return fallback
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
