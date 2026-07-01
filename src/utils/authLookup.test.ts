import MockAdapter from 'axios-mock-adapter'

// Replace @/axiosConfig with a fresh axios instance. The production module
// reads import.meta.env at top level and swc/jest leaves that literal in
// the CommonJS output, which throws "Cannot use 'import.meta' outside a
// module" on load. No interceptor is registered: every lookup call passes
// skipAuthHandling: true, so the interceptor would rethrow untouched and
// its absence does not change the behavior under test.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { lookupIdpForEmail } from './authLookup'

const mock = new MockAdapter(axiosInstance)

afterEach(() => {
  mock.reset()
})

describe('lookupIdpForEmail - clean backend answers', () => {
  it('returns { idp: "okta" } for an Okta-routed email', async () => {
    mock.onGet('/auth/lookup').reply(200, { data: { idp: 'okta' } })
    await expect(lookupIdpForEmail('user@okta.example')).resolves.toEqual({
      idp: 'okta',
    })
  })

  it('returns { idp: "entra" } for an Entra-routed email', async () => {
    mock.onGet('/auth/lookup').reply(200, { data: { idp: 'entra' } })
    await expect(lookupIdpForEmail('user@entra.example')).resolves.toEqual({
      idp: 'entra',
    })
  })

  it('returns { idp: null } for the non-enumeration "no IdP" response', async () => {
    mock.onGet('/auth/lookup').reply(200, { data: { idp: null } })
    await expect(lookupIdpForEmail('nobody@example.com')).resolves.toEqual({
      idp: null,
    })
  })
})

describe('lookupIdpForEmail - transport/server failures surface as unavailable', () => {
  it('maps a request timeout to { unavailable: true }', async () => {
    mock.onGet('/auth/lookup').timeout()
    await expect(lookupIdpForEmail('user@example.com')).resolves.toEqual({
      unavailable: true,
    })
  })

  it('maps a network error to { unavailable: true }', async () => {
    mock.onGet('/auth/lookup').networkError()
    await expect(lookupIdpForEmail('user@example.com')).resolves.toEqual({
      unavailable: true,
    })
  })

  it('maps a 5xx to { unavailable: true }', async () => {
    mock.onGet('/auth/lookup').reply(500, { error: 'boom' })
    await expect(lookupIdpForEmail('user@example.com')).resolves.toEqual({
      unavailable: true,
    })
  })

  it('maps a 4xx to { unavailable: true }', async () => {
    mock.onGet('/auth/lookup').reply(429, { error: 'slow down' })
    await expect(lookupIdpForEmail('user@example.com')).resolves.toEqual({
      unavailable: true,
    })
  })
})

describe('lookupIdpForEmail - malformed 2xx is not a genuine null', () => {
  it('treats an unknown idp marker as unavailable, not as null', async () => {
    mock.onGet('/auth/lookup').reply(200, { data: { idp: 'bogus' } })
    await expect(lookupIdpForEmail('user@example.com')).resolves.toEqual({
      unavailable: true,
    })
  })

  it('treats a missing data envelope as unavailable', async () => {
    mock.onGet('/auth/lookup').reply(200, {})
    await expect(lookupIdpForEmail('user@example.com')).resolves.toEqual({
      unavailable: true,
    })
  })

  it('treats a present envelope with an absent idp marker as unavailable', async () => {
    mock.onGet('/auth/lookup').reply(200, { data: {} })
    await expect(lookupIdpForEmail('user@example.com')).resolves.toEqual({
      unavailable: true,
    })
  })
})
