import { getTodayISO, validateDecommissionDate } from './helpers'

describe('getTodayISO', () => {
  test('formats a Date as yyyy-mm-dd in the local timezone', () => {
    // Construct a local-midnight Date so the formatter's getMonth/getDate
    // calls return the same component values across CI timezones.
    const ref = new Date(2026, 4, 3) // 3 May 2026, local midnight
    expect(getTodayISO(ref)).toBe('2026-05-03')
  })

  test('pads single-digit month + day to two digits', () => {
    expect(getTodayISO(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(getTodayISO(new Date(2026, 8, 9))).toBe('2026-09-09')
  })
})

describe('validateDecommissionDate', () => {
  // All cases use the same local-noon "now" so the past/today/future
  // comparisons are well-defined regardless of CI timezone.
  const now = new Date(2026, 5, 25, 12, 0, 0)

  test('empty string -> required', () => {
    expect(validateDecommissionDate('', now)).toEqual({
      ok: false,
      error: 'Date is required',
    })
  })

  test('garbage string -> invalid', () => {
    expect(validateDecommissionDate('not-a-date', now)).toEqual({
      ok: false,
      error: 'Invalid date',
    })
  })

  test('today is accepted', () => {
    expect(validateDecommissionDate('2026-06-25', now)).toEqual({
      ok: true,
      error: '',
    })
  })

  test('past date is accepted', () => {
    expect(validateDecommissionDate('2025-12-31', now)).toEqual({
      ok: true,
      error: '',
    })
  })

  test('future date is rejected', () => {
    expect(validateDecommissionDate('2026-06-26', now)).toEqual({
      ok: false,
      error: 'Date cannot be in the future',
    })
  })

  test('far-future date is rejected', () => {
    expect(validateDecommissionDate('2099-01-01', now)).toEqual({
      ok: false,
      error: 'Date cannot be in the future',
    })
  })
})
