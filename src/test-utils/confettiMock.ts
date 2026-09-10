// Shared canvas-confetti test double for suites that assert the celebration
// burst fired. The real library draws to a 2D canvas context jsdom does not
// provide, so it cannot run under tests; a no-op default is installed globally
// in config/jest/setupTests.ts. Suites that need to assert on the burst opt in
// to this asserting version instead:
//
//   jest.mock('canvas-confetti', () =>
//     require('@/test-utils/confettiMock').confettiMockFactory()
//   )
//   beforeEach(() => reinstallConfettiMock())
//   ...
//   expect(confettiFireMock).toHaveBeenCalled()
//
// The spies live here (not inside the factory) so the module never imports the
// mocked package, which would deadlock: the jest.mock factory requires this
// module, so this module importing canvas-confetti back would be a cycle.

/**
 * The fire function create() hands back. A jest.fn so a suite can assert the
 * burst launched; reset() is attached because the component calls it on
 * unmount cleanup.
 */
export const confettiFireMock = Object.assign(jest.fn(), { reset: jest.fn() })

/** The mocked confetti.create; asserts whether an animation was started. */
export const confettiCreateMock = jest.fn(() => confettiFireMock)

/**
 * Factory for jest.mock('canvas-confetti', ...). Mirrors the real module shape
 * the component imports: a default export whose create() returns the shared
 * fire function above.
 * @returns {object} An ES-module shim with a default confetti export.
 */
export const confettiMockFactory = () => {
  const confettiFn = jest.fn()
  ;(confettiFn as unknown as { create: unknown }).create = confettiCreateMock
  return { __esModule: true, default: confettiFn }
}

/**
 * Re-establish the mock in a beforeEach. jest.config sets resetMocks:true,
 * which wipes spy implementations before each test, so create() must be
 * re-pointed at the fire function and both spies cleared.
 * @returns {void}
 */
export const reinstallConfettiMock = (): void => {
  confettiCreateMock.mockClear()
  confettiFireMock.mockClear()
  confettiCreateMock.mockReturnValue(confettiFireMock)
}
