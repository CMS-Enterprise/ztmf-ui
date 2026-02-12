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

/** Truncates notes for display in confirmation dialogs */
export function truncateNotes(notes: string): string {
  const trimmed = notes.trim()
  if (!trimmed) return ''
  return trimmed.length > MAX_NOTES_DISPLAY_LENGTH
    ? trimmed.substring(0, MAX_NOTES_DISPLAY_LENGTH) + '...'
    : trimmed
}
