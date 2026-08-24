// US-format (MM/DD/YYYY) date entry without a picker dependency: the field
// masks slashes in as the user types, and the filter only applies once the
// value parses to a real calendar date. Deliberate choice over adding
// @mui/x-date-pickers while the MUI upgrade plan (ui#625) is open.

// Rebuilds the masked value from the digits alone, so deletions never fight
// the mask: removing a trailing slash removes the digit boundary with it.
export function maskUSDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

// Strict parse of a complete masked value. Round-trips through Date fields to
// reject impossible dates (02/30/2026 rolls over; the round-trip catches it).
export function parseUSDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

// A date typed into "from" means the start of that local day; into "to", the
// end of it. Both convert to RFC3339 UTC instants for the query params, so
// the bounds match what the admin's wall clock calls that day.
export function startOfDayISO(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function endOfDayISO(date: Date): string {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}
