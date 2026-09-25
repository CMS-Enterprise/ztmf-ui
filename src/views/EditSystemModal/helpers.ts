/**
 * Returns today's date as an `yyyy-mm-dd` string in the user's local
 * timezone, formatted for a `<input type="date">` value. Same shape as
 * the spec format the decommission picker expects (HTML5 date inputs are
 * always ISO date strings regardless of locale).
 * @param {Date} [now] - Override for tests. Defaults to a new Date().
 * @returns {string} Today's date as `yyyy-mm-dd`.
 */
export function getTodayISO(now: Date = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Result of {@link validateDecommissionDate}. */
export interface DecommissionDateValidation {
  /** True when the date is valid for submission. */
  ok: boolean
  /** Error message to render under the input; empty when ok. */
  error: string
}

/**
 * Validates a `yyyy-mm-dd` decommission date from the picker.
 *
 *   - Empty string -> "Date is required"
 *   - Unparseable -> "Invalid date"
 *   - Future of today (local) -> "Date cannot be in the future"
 *   - Otherwise -> ok with empty error.
 *
 * Comparison uses local midnight for `today` and UTC midnight for the
 * candidate, matching the modal's previous in-line behavior (the picker's
 * `value` is parsed as a UTC instant via the `T00:00:00.000Z` suffix while
 * `today` is the local zero-of-day). Same-day in any timezone west of UTC
 * is therefore treated as valid.
 * @param {string} dateStr - The picker's current `yyyy-mm-dd` value.
 * @param {Date} [now] - Override for tests. Defaults to a new Date().
 * @returns {DecommissionDateValidation} ok flag + error string.
 */
export function validateDecommissionDate(
  dateStr: string,
  now: Date = new Date()
): DecommissionDateValidation {
  if (!dateStr) return { ok: false, error: 'Date is required' }
  const parsed = new Date(dateStr + 'T00:00:00.000Z')
  if (isNaN(parsed.getTime())) return { ok: false, error: 'Invalid date' }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (parsed > today) {
    return { ok: false, error: 'Date cannot be in the future' }
  }
  return { ok: true, error: '' }
}
