import '@testing-library/jest-dom'
import 'jest-fetch-mock'
import { TextEncoder, TextDecoder } from 'util'
import { webcrypto } from 'crypto'

// Polyfill for React Router 7 which requires TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// Polyfill Web Crypto API — JSDOM does not expose crypto.subtle
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
  writable: true,
})
