// The events filter uses a themed MUI DatePicker, which hands back a Date
// object. These helpers turn a chosen day into the RFC3339 day-bounds the
// /events endpoint's from/to params expect.

// A date chosen for "from" means the start of that local day; for "to", the
// end of it. Both convert to RFC3339 UTC instants for the query params, so the
// bounds match what the admin's wall clock calls that day.
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
