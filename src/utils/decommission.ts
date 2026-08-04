/** Max character length for decommission notes input */
export const MAX_NOTES_LENGTH = 500

/** Max characters to display in confirmation dialog before truncating */
export const MAX_NOTES_DISPLAY_LENGTH = 100

/** Returns today's date as an ISO date string (YYYY-MM-DD) in local time */
export function getTodayISO(): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Returns the date `months` months from today as an ISO date string
 * (YYYY-MM-DD) in local time. Used to seed the delegate expiration picker
 * with its +3-month default. Day-of-month overflow (e.g. Aug 31 + 6mo)
 * rolls forward via the Date constructor, which is fine for a default.
 *
 * @param months - Number of months to add to today.
 * @returns The shifted date as a YYYY-MM-DD string.
 */
export function addMonthsISO(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Truncates notes for display in confirmation dialogs */
export function truncateNotes(notes: string): string {
  const trimmed = notes.trim()
  if (!trimmed) return ''
  return trimmed.length > MAX_NOTES_DISPLAY_LENGTH
    ? trimmed.substring(0, MAX_NOTES_DISPLAY_LENGTH) + '...'
    : trimmed
}
