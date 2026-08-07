import {
  LAST_SEEN_EMPTY_LABEL,
  compareLastSeen,
  formatLastSeenAbsolute,
  formatLastSeenRelative,
  parseLastSeen,
} from './lastSeen'

describe('parseLastSeen', () => {
  it('parses a backend ISO timestamp (microseconds + Z)', () => {
    const d = parseLastSeen('2026-08-04T11:52:20.090616Z')
    expect(d).toBeInstanceOf(Date)
    expect(d!.toISOString()).toBe('2026-08-04T11:52:20.090Z')
  })

  it('returns null for null, undefined, and empty string', () => {
    expect(parseLastSeen(null)).toBeNull()
    expect(parseLastSeen(undefined)).toBeNull()
    expect(parseLastSeen('')).toBeNull()
  })

  it('returns null for an unparseable string', () => {
    expect(parseLastSeen('not-a-date')).toBeNull()
  })
})

describe('formatLastSeenRelative', () => {
  const now = new Date('2026-08-07T12:00:00Z')
  const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000)

  it.each([
    [30, 'just now'],
    [5 * 60, '5 minutes ago'],
    [3 * 3600, '3 hours ago'],
    [3 * 24 * 3600, '3 days ago'],
    [2 * 7 * 24 * 3600, '2 weeks ago'],
    [65 * 24 * 3600, '2 months ago'],
    [2 * 365 * 24 * 3600, '2 years ago'],
  ])('%d seconds ago renders "%s"', (seconds, expected) => {
    expect(formatLastSeenRelative(secondsAgo(seconds), now)).toBe(expected)
  })

  it('treats a slightly-ahead server clock as "just now"', () => {
    expect(formatLastSeenRelative(secondsAgo(-10), now)).toBe('just now')
  })
})

describe('formatLastSeenAbsolute', () => {
  it('produces a locale date-time string containing the year', () => {
    const out = formatLastSeenAbsolute(new Date('2026-08-04T11:52:20Z'))
    expect(out).toContain('2026')
  })
})

describe('compareLastSeen', () => {
  const older = new Date('2026-01-01T00:00:00Z')
  const newer = new Date('2026-08-01T00:00:00Z')

  it('orders two dates chronologically under asc', () => {
    expect(compareLastSeen(older, newer, 'asc')).toBeLessThan(0)
    expect(compareLastSeen(newer, older, 'asc')).toBeGreaterThan(0)
    expect(compareLastSeen(older, older, 'asc')).toBe(0)
  })

  it('sorts null after any date under asc', () => {
    expect(compareLastSeen(null, older, 'asc')).toBeGreaterThan(0)
    expect(compareLastSeen(older, null, 'asc')).toBeLessThan(0)
  })

  // The grid negates the comparator result when sorting desc, so the raw
  // return values here are inverted relative to the final row order: -1 for
  // (null, date) becomes +1 after negation, which still places null last.
  it('pre-compensates under desc so null still lands last after negation', () => {
    expect(compareLastSeen(null, older, 'desc')).toBeLessThan(0)
    expect(compareLastSeen(older, null, 'desc')).toBeGreaterThan(0)
  })

  it('treats two nulls as equal in both directions', () => {
    expect(compareLastSeen(null, null, 'asc')).toBe(0)
    expect(compareLastSeen(undefined, null, 'desc')).toBe(0)
  })

  it('end-to-end: grid sort simulation keeps nulls last both ways', () => {
    const rows: (Date | null)[] = [newer, null, older, null]
    const asc = [...rows].sort((a, b) => compareLastSeen(a, b, 'asc'))
    expect(asc).toEqual([older, newer, null, null])
    // Desc mirrors the grid: it negates the comparator's result.
    const desc = [...rows].sort((a, b) => -compareLastSeen(a, b, 'desc'))
    expect(desc).toEqual([newer, older, null, null])
  })
})

describe('LAST_SEEN_EMPTY_LABEL', () => {
  // Tracking began 2026-08-06; for older accounts null means "nothing since
  // tracking began", not "never signed in". Pin the neutral wording so it
  // doesn't drift into something accusatory like "Never logged in".
  it('is neutral about sign-in history', () => {
    expect(LAST_SEEN_EMPTY_LABEL).toBe('No activity recorded')
    expect(LAST_SEEN_EMPTY_LABEL.toLowerCase()).not.toContain('login')
    expect(LAST_SEEN_EMPTY_LABEL.toLowerCase()).not.toContain('never')
  })
})
