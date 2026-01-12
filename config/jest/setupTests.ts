import '@testing-library/jest-dom'
import 'jest-fetch-mock'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill for React Router 7 which requires TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder
