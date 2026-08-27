// The confetti burst is a mount-triggered side effect on a canvas the
// component owns, so these assert on the mocked library calls rather than the
// DOM. See @/test-utils/confettiMock for the shared double.

jest.mock('canvas-confetti', () =>
  require('@/test-utils/confettiMock').confettiMockFactory()
)

import { render } from '@testing-library/react'
import ConfettiBurst from './ConfettiBurst'
import {
  confettiCreateMock,
  confettiFireMock,
  reinstallConfettiMock,
} from '@/test-utils/confettiMock'

// Drive prefers-reduced-motion for a single render. jsdom has no real
// matchMedia, so each test installs the exact matches value it needs.
const setReducedMotion = (matches: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  reinstallConfettiMock()
})

test('fires a confetti burst on mount', () => {
  setReducedMotion(false)
  render(<ConfettiBurst />)
  expect(confettiFireMock).toHaveBeenCalledTimes(1)
})

test('suppresses the burst when the user prefers reduced motion', () => {
  setReducedMotion(true)
  render(<ConfettiBurst />)
  expect(confettiCreateMock).not.toHaveBeenCalled()
  expect(confettiFireMock).not.toHaveBeenCalled()
})
