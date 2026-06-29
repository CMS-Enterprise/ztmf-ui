import { toSlug, addSpace, relativeTimeFrom } from './helpers'

describe('toSlug', () => {
  test('splits CamelCase into hyphenated lowercase', () => {
    expect(toSlug('ApplicationsAndWorkloads')).toBe(
      'applications-and-workloads'
    )
    expect(toSlug('AppInventory')).toBe('app-inventory')
  })

  test('converts whitespace to hyphens', () => {
    expect(toSlug('Cross Cutting')).toBe('cross-cutting')
  })

  test('passes through already-lowercase tokens unchanged', () => {
    expect(toSlug('data')).toBe('data')
  })
})

describe('addSpace', () => {
  test('inserts a space before each interior capital letter', () => {
    expect(addSpace('AppInventory')).toBe('App Inventory')
    expect(addSpace('CrossCutting')).toBe('Cross Cutting')
  })

  test('leaves single-word inputs unchanged', () => {
    expect(addSpace('Data')).toBe('Data')
  })

  // The helper is called on API-supplied function names, which are always
  // CamelCase with no pre-existing spaces - so the "input already contains
  // spaces" case is not exercised in production and is intentionally not
  // pinned here.
})

describe('relativeTimeFrom', () => {
  // relativeTimeFrom calls Date.now() at runtime, so freeze the clock
  // around each case to assert against a known reference.
  const FIXED_NOW = new Date('2026-06-25T12:00:00Z').getTime()
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('"just now" for under 30 seconds ago', () => {
    expect(relativeTimeFrom(new Date(FIXED_NOW - 5_000))).toBe('just now')
    expect(relativeTimeFrom(new Date(FIXED_NOW - 29_000))).toBe('just now')
  })

  test('"1 min ago" for the 30-90 second band', () => {
    expect(relativeTimeFrom(new Date(FIXED_NOW - 30_000))).toBe('1 min ago')
    expect(relativeTimeFrom(new Date(FIXED_NOW - 89_000))).toBe('1 min ago')
  })

  test('"N min ago" for the under-hour band', () => {
    expect(relativeTimeFrom(new Date(FIXED_NOW - 5 * 60_000))).toBe('5 min ago')
    expect(relativeTimeFrom(new Date(FIXED_NOW - 59 * 60_000))).toBe(
      '59 min ago'
    )
  })

  test('"N hr ago" for under-day band', () => {
    expect(relativeTimeFrom(new Date(FIXED_NOW - 2 * 3600_000))).toBe(
      '2 hr ago'
    )
    expect(relativeTimeFrom(new Date(FIXED_NOW - 23 * 3600_000))).toBe(
      '23 hr ago'
    )
  })

  test('falls back to a localized date string for anything 24h+ old', () => {
    const out = relativeTimeFrom(new Date(FIXED_NOW - 25 * 3600_000))
    // The locale-specific format varies by runtime; assert it is not one of
    // the relative buckets and that it contains a year (a reliable invariant
    // for the dateStyle: 'medium' format).
    expect(out).not.toMatch(/ago$|^just now$/)
    expect(out).toMatch(/2026/)
  })

  test('clamps a future Date to "just now" rather than going negative', () => {
    expect(relativeTimeFrom(new Date(FIXED_NOW + 10_000))).toBe('just now')
  })
})
