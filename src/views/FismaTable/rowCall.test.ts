import type { datacall } from '@/types'
import { resolveRowCallId, datacallNameComparator } from './rowCall'

const call = (datacallid: number, deadline: string): datacall => ({
  datacallid,
  datacall: `call-${datacallid}`,
  datecreated: deadline,
  deadline,
})

// Deliberately not in deadline order: id 2 has the newest deadline, so any
// resolution that keys on id order instead of deadline gets caught.
const DATACALLS = [
  call(1, '2025-01-15T00:00:00Z'),
  call(3, '2025-07-15T00:00:00Z'),
  call(2, '2026-01-15T00:00:00Z'),
]

test('prefers the chosen (most-recently-updated) call', () => {
  expect(resolveRowCallId(7, { 7: 1 }, { 7: [1, 2, 3] }, DATACALLS, 3)).toBe(1)
})

test('falls back to the newest-by-deadline call the system has scores in', () => {
  expect(resolveRowCallId(7, {}, { 7: [1, 2] }, DATACALLS, 3)).toBe(2)
})

test('falls back to the active call when the system has no call data', () => {
  expect(resolveRowCallId(7, {}, {}, DATACALLS, 3)).toBe(3)
})

test('ignores score-call ids that resolve to no known call', () => {
  expect(resolveRowCallId(7, {}, { 7: [99] }, DATACALLS, 3)).toBe(3)
})

describe('datacallNameComparator', () => {
  // Names chosen so string order CONTRADICTS deadline order: "FY2025 Q3"
  // string-sorts before "FY25 ZTM" but has the newer deadline here, so a
  // regression to name comparison fails these assertions.
  const deadlines = new Map([
    ['FY25 ZTM', Date.parse('2025-09-30T00:00:00Z')],
    ['FY2025 Q3', Date.parse('2026-03-31T00:00:00Z')],
  ])
  const cmp = datacallNameComparator(deadlines)

  it('orders by deadline, not by name', () => {
    expect(cmp('FY25 ZTM', 'FY2025 Q3')).toBeLessThan(0)
    expect(cmp('FY2025 Q3', 'FY25 ZTM')).toBeGreaterThan(0)
  })

  it('returns 0 on equal deadlines and on two unknown names', () => {
    expect(cmp('FY25 ZTM', 'FY25 ZTM')).toBe(0)
    expect(cmp('', 'nonsense')).toBe(0)
  })

  it('sinks an unknown or blank name to the oldest end', () => {
    expect(cmp('', 'FY25 ZTM')).toBeLessThan(0)
    expect(cmp('FY2025 Q3', '')).toBeGreaterThan(0)
  })
})
