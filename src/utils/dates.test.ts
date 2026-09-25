import { formatDate, formatDateTime } from './dates'

describe('formatDate', () => {
  it('renders the D3 calendar shape', () => {
    expect(formatDate('2025-09-30T12:00:00Z')).toBe('Sep 30, 2025')
  })

  it('keeps a UTC-midnight day on its own date instead of shifting back', () => {
    // The regression this formatter exists for: a decommission stored as
    // 1977-05-25 00:00:00+00 used to render 5/24/1977 anywhere behind UTC.
    expect(formatDate('1977-05-25T00:00:00Z')).toBe('May 25, 1977')
  })

  it('treats a bare YYYY-MM-DD as that day', () => {
    expect(formatDate('1977-05-25')).toBe('May 25, 1977')
  })

  it.each([
    '2026-12-13',
    '2026-12-13 00:00:00.000',
    '2026-12-13T00:00:00',
    '2026-12-13 00:00:00+00',
    '2026-12-13T00:00:00.000Z',
  ])('reads the zone-less and UTC spellings of one day alike: %s', (v) => {
    expect(formatDate(v)).toBe('Dec 13, 2026')
  })

  it('accepts a Date', () => {
    expect(formatDate(new Date('2025-01-02T00:00:00Z'))).toBe('Jan 2, 2025')
  })

  it.each([null, undefined, '', 'not a date'])('falls back for %p', (v) => {
    expect(formatDate(v)).toBe('-')
  })

  it('honors a caller-supplied fallback', () => {
    expect(formatDate(null, 'No expiration')).toBe('No expiration')
  })
})

describe('formatDateTime', () => {
  // Built from local components so the expectation holds in any TZ the
  // suite runs under; jest does not pin one.
  it('renders the D3 timestamp shape in the viewer timezone', () => {
    expect(formatDateTime(new Date(2025, 8, 30, 19, 0))).toBe(
      'Sep 30, 2025, 7:00 PM'
    )
  })

  it('pads minutes and uses a 12-hour clock', () => {
    expect(formatDateTime(new Date(2025, 8, 30, 7, 5))).toBe(
      'Sep 30, 2025, 7:05 AM'
    )
  })

  it.each([null, undefined, '', 'not a date'])('falls back for %p', (v) => {
    expect(formatDateTime(v)).toBe('-')
  })

  it('honors a caller-supplied fallback', () => {
    expect(formatDateTime(undefined, 'Never')).toBe('Never')
  })
})
