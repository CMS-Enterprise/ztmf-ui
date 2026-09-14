import { render, screen } from '@testing-library/react'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import MockAdapter from 'axios-mock-adapter'
import { ERROR_MESSAGES } from '@/constants'
import { Routes } from '@/router/constants'
import { SignInReasons } from '@/utils/authCodes'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: {
    navigate: jest.fn(),
    revalidate: jest.fn(),
    state: {
      location: { pathname: '/' },
      navigation: { location: undefined },
      revalidation: 'idle',
      loaderData: { root: { status: 200 } },
    },
  },
}))

jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return {
    ...actual,
    notify: jest.fn(),
  }
})

// Use a fresh Axios instance with the production response interceptor. The
// production module itself reads import.meta.env, which Jest cannot parse.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  const { handleAuthError } = require('@/utils/authInterceptor')
  const instance = axios.create({ baseURL: 'api/v1/' })
  instance.interceptors.response.use(
    (response: unknown) => response,
    handleAuthError
  )
  return { __esModule: true, default: instance }
})

import axiosInstance from '@/axiosConfig'
import router from '@/router/router'
import { notify } from '@/utils/notify'
import queryClient from '@/queryClient'

const mock = new MockAdapter(axiosInstance)
const mockedNavigate = (router as unknown as { navigate: jest.Mock }).navigate
const mockedRevalidate = (router as unknown as { revalidate: jest.Mock })
  .revalidate
const mockedNotify = notify as jest.Mock

function QueryProbe({ path }: { path: string }) {
  const { status } = useQuery({
    queryKey: ['query-interop', path],
    queryFn: ({ signal }) => axiosInstance.get(path, { signal }),
  })
  return <div>{status}</div>
}

beforeEach(() => {
  queryClient.clear()
  mock.reset()
  mockedNavigate.mockReset()
  mockedRevalidate.mockReset()
  mockedNotify.mockReset()
})

afterAll(() => {
  queryClient.clear()
  mock.restore()
})

test('a 401 inside a queryFn redirects once without retrying or double-toasting', async () => {
  mock.onGet('/query-auth-contract').reply(401)

  renderProbe('/query-auth-contract')

  expect(await screen.findByText('error')).toBeInTheDocument()
  expect(mock.history.get).toHaveLength(1)
  expect(mockedRevalidate).toHaveBeenCalledTimes(1)
  expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
    replace: true,
    state: {
      message: ERROR_MESSAGES.expired,
      reason: SignInReasons.EXPIRED,
    },
  })
  expect(mockedNotify).not.toHaveBeenCalled()
})

test('an ordinary query failure is normalized and notified by the cache', async () => {
  mock.onGet('/query-error-contract').reply(400, {
    error: 'The request was invalid',
  })

  renderProbe('/query-error-contract')

  expect(await screen.findByText('error')).toBeInTheDocument()
  expect(mockedNotify).toHaveBeenCalledWith(
    'The request was invalid',
    'error',
    expect.objectContaining({ preventDuplicate: true })
  )
})

function renderProbe(path: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <QueryProbe path={path} />
    </QueryClientProvider>
  )
}
