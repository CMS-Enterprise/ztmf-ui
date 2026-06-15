import { screen } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { ERROR_MESSAGES } from '@/constants'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

// Replace @/axiosConfig with a fresh axios instance carrying the same
// interceptor. The production module accesses import.meta.env at top
// level and swc/jest leaves that literal in the CommonJS output, which
// throws on load.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default

  const { handleAuthError } = require('@/utils/authInterceptor')
  const instance = axios.create({ baseURL: '/api/v1/' })
  instance.interceptors.response.use(
    (response: unknown) => response,
    handleAuthError
  )
  return { __esModule: true, default: instance }
})

import axiosInstance from '@/axiosConfig'
import router from '@/router/router'
import CfactsRecordCard from './CfactsRecordCard'
import { renderWithProviders } from '@/test-utils/renderWithProviders'

const mockedNavigate = (router as unknown as { navigate: jest.Mock }).navigate
const mock = new MockAdapter(axiosInstance)
const FISMA_UID = 'TEST-FISMA-UID'

beforeEach(() => {
  mock.reset()
  mockedNavigate.mockReset()
})

test('200 response renders the enrichment cards with payload fields', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
        fisma_acronym: 'TEST',
        component_acronym: 'CMS',
        primary_isso_name: 'Test ISSO',
        primary_isso_email: 'isso@example.com',
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(<CfactsRecordCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Test Package')).toBeInTheDocument()
  expect(screen.getByText('Test ISSO')).toBeInTheDocument()
})

// This is the key skipAuthHandling integration test: a 403 must produce
// the muted empty state, NOT the centralized permission snackbar. If
// the opt-out flag stops being honored upstream, this test fails.
test('403 renders the quiet empty state and the interceptor stays out of the way', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(403)

  renderWithProviders(<CfactsRecordCard fismaUid={FISMA_UID} />)

  expect(
    await screen.findByText(/no ztmf insights data found/i)
  ).toBeInTheDocument()
  // The opt-out is real: no permission snackbar fired anywhere.
  expect(screen.queryByText(ERROR_MESSAGES.permission)).not.toBeInTheDocument()
  // And no redirect either - skipAuthHandling bypasses both branches.
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('404 renders the same quiet empty state', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(404)

  renderWithProviders(<CfactsRecordCard fismaUid={FISMA_UID} />)

  expect(
    await screen.findByText(/no ztmf insights data found/i)
  ).toBeInTheDocument()
})

test('500 renders the failed-to-load message', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(500)

  renderWithProviders(<CfactsRecordCard fismaUid={FISMA_UID} />)

  expect(
    await screen.findByText(/failed to load ztmf insights data/i)
  ).toBeInTheDocument()
})
