import { deriveExportCallId } from './exportCall'

// The export endpoint targets one data call; these pin how the target is
// derived from a row selection (ported from main's footer-component tests
// when the export action moved into the page header).

test('targets a not-started system displayed call, not the active call', () => {
  // A not-started system has no score-derived call (empty systemCallMap), but
  // the dashboard shows it against call 7 (a past-year view). The export must
  // target 7, not the active call 42 - otherwise a past-year export silently
  // hits the wrong call once the backend starts returning rows for it.
  expect(deriveExportCallId([3], {}, { 3: 7 }, 42)).toBe(7)
})

test('returns null when selected rows display different calls', () => {
  // Two never-started rows shown against different calls have no single
  // export target, so the button disables rather than guessing.
  expect(deriveExportCallId([3, 4], {}, { 3: 7, 4: 9 }, 42)).toBeNull()
})

test('targets a scored system score-derived call', () => {
  // A scored system resolves through systemCallMap (calls it has scores in),
  // not the chosen-call fallback. Pins that the not-started fallback did not
  // displace the original path.
  expect(deriveExportCallId([1], { 1: [7] }, {}, 42)).toBe(7)
})

test('resolves a mixed scored + not-started selection sharing one call', () => {
  // Scored system 1 has a score in call 7; not-started system 3 is displayed
  // against call 7. They share one target, so export goes to call 7 rather
  // than disabling or splitting.
  expect(deriveExportCallId([1, 3], { 1: [7] }, { 3: 7 }, 42)).toBe(7)
})

test('an empty selection falls back to the active call', () => {
  expect(deriveExportCallId([], {}, {}, 42)).toBe(42)
})
