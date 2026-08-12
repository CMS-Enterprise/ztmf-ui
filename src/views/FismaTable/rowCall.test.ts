import type { datacall } from '@/types'
import {
  resolveRowCallId,
  resolveQuestionnaireCall,
  datacallNameComparator,
} from './rowCall'

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

describe('last-resort call for a system with no data in the view', () => {
  // Call 2 has the newest deadline, so it stands in for the open call; calls 1
  // and 3 stand in for a historical year the picker has selected.
  it('prefers the newest selected call when the active call is out of view', () => {
    // The reported shape: selecting a year toggles all of its calls on, which
    // collapses activeDataCallId to the open call even though the user is
    // looking at a historical group. Labelling the row with call 2 there would
    // name a call that is not on screen.
    expect(resolveRowCallId(7, {}, {}, DATACALLS, 2, [1, 3])).toBe(3)
  })

  it('keeps the active call when it is one of the selected calls', () => {
    expect(resolveRowCallId(7, {}, {}, DATACALLS, 1, [1, 3])).toBe(1)
  })

  it('falls back to the active call when no calls are selected', () => {
    expect(resolveRowCallId(7, {}, {}, DATACALLS, 2, [])).toBe(2)
  })

  it('falls back to the active call when the selection resolves to no known call', () => {
    expect(resolveRowCallId(7, {}, {}, DATACALLS, 2, [99])).toBe(2)
  })

  it('still prefers real row data over the view', () => {
    expect(resolveRowCallId(7, { 7: 1 }, {}, DATACALLS, 2, [2, 3])).toBe(1)
    expect(resolveRowCallId(7, {}, { 7: [1] }, DATACALLS, 2, [2, 3])).toBe(1)
  })
})

describe('resolveQuestionnaireCall', () => {
  it('opens the column call for a score-less system, not the active call', () => {
    // Past-year view: calls 1 and 3 are selected, the open call (2) is not. A
    // score-less system is displayed against call 3. The icon must open call 3,
    // the same call the column names - not the open call the old activeDataCallId
    // fallback resolved to.
    const call = resolveQuestionnaireCall(7, { 7: 3 }, {}, DATACALLS, 2, [1, 3])
    expect(call?.datacallid).toBe(3)
    expect(call?.datacallid).not.toBe(2)
  })

  it('opens the displayed call, not a hidden older scored call', () => {
    // Scored in older call 1 but displayed against newer call 3 (a progress-only
    // row updated more recently), so the row reads "Not scored" and its column
    // names 3. The icon opens 3 to match the column, not the hidden score in 1.
    const call = resolveQuestionnaireCall(
      7,
      { 7: 3 },
      { 7: [1] },
      DATACALLS,
      2,
      [1, 3]
    )
    expect(call?.datacallid).toBe(3)
  })

  it('matches the column newest-in-view fallback for a score-less system with no chosen call', () => {
    // No chosen call and the active call is out of view: both the column and the
    // icon resolve to the newest selected call (3), not the open call (2).
    const call = resolveQuestionnaireCall(7, {}, {}, DATACALLS, 2, [1, 3])
    expect(call?.datacallid).toBe(3)
  })

  it('keeps the active call when it is one of the selected calls (no regression)', () => {
    const call = resolveQuestionnaireCall(7, {}, {}, DATACALLS, 1, [1, 3])
    expect(call?.datacallid).toBe(1)
  })

  it('always names the same call as the Data Call column', () => {
    // The icon and the column must never disagree: resolveQuestionnaireCall is
    // resolveRowCallId plus a lookup, so it matches for every input shape.
    const cases: Parameters<typeof resolveRowCallId>[] = [
      [7, { 7: 3 }, {}, DATACALLS, 2, [1, 3]],
      [7, { 7: 3 }, { 7: [1] }, DATACALLS, 2, [1, 3]],
      [7, {}, { 7: [1, 2] }, DATACALLS, 3],
      [7, {}, {}, DATACALLS, 2, [1, 3]],
      [7, {}, {}, DATACALLS, 1, [1, 3]],
    ]
    for (const args of cases) {
      expect(resolveQuestionnaireCall(...args)?.datacallid).toBe(
        resolveRowCallId(...args)
      )
    }
  })
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

  describe('unparseable deadlines', () => {
    // A record whose deadline is present but malformed maps to NaN, which is
    // not the same as being absent from the map. Returning NaN from a
    // comparator is outside Array.prototype.sort's contract and leaves the
    // row's position up to the engine, so NaN has to reach the same sentinel
    // an unknown name does.
    const withBad = new Map([
      ['bad-deadline', Number.NaN],
      ['also-bad', Number.NaN],
      ['FY25 ZTM', Date.parse('2025-09-30T00:00:00Z')],
    ])
    const cmpBad = datacallNameComparator(withBad)

    it('never returns NaN', () => {
      expect(cmpBad('bad-deadline', 'FY25 ZTM')).not.toBeNaN()
      expect(cmpBad('FY25 ZTM', 'bad-deadline')).not.toBeNaN()
      expect(cmpBad('bad-deadline', 'also-bad')).not.toBeNaN()
    })

    it('sinks a malformed deadline to the oldest end', () => {
      expect(cmpBad('bad-deadline', 'FY25 ZTM')).toBeLessThan(0)
      expect(cmpBad('FY25 ZTM', 'bad-deadline')).toBeGreaterThan(0)
    })

    it('treats two malformed deadlines as equal', () => {
      expect(cmpBad('bad-deadline', 'also-bad')).toBe(0)
    })
  })
})
