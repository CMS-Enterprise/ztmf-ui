import type { datacall } from '@/types'
import { resolveRowCallId } from './rowCall'

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
