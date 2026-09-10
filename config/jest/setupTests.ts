import '@testing-library/jest-dom'
import 'jest-fetch-mock'
import { TextEncoder, TextDecoder } from 'util'
import { webcrypto } from 'crypto'

// jsdom does not implement ResizeObserver; stub it for components that use it
// (e.g. Recharts ResponsiveContainer).
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// Polyfill for React Router 7 which requires TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// Polyfill Web Crypto API — JSDOM does not expose crypto.subtle
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
  writable: true,
})

// canvas-confetti draws to a real <canvas>, and jsdom has no 2D context, so the
// real library throws mid-animation whenever a completed questionnaire renders.
// Default every suite to a no-op. Plain functions (not jest.fn) so resetMocks
// leaves them intact; the dedicated confetti tests override this with a mock
// they assert on.
jest.mock('canvas-confetti', () => {
  const fire = Object.assign(() => {}, { reset: () => {} })
  const confetti = () => {}
  ;(confetti as unknown as { create: unknown }).create = () => fire
  return { __esModule: true, default: confetti }
})
