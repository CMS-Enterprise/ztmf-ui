jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

import { AxiosError } from 'axios'
import type { Query } from '@tanstack/react-query'
import { notify } from '@/utils/notify'
import queryClient, {
  handleQueryError,
  retryOnlyTransientFailures,
} from './queryClient'

const mockedNotify = notify as jest.Mock

/** A minimal observed query the cache-boundary handler can read. */
function observedQuery(meta?: Record<string, unknown>) {
  return {
    meta,
    queryHash: '["some-key"]',
    getObserversCount: () => 1,
  } as unknown as Query<unknown, unknown>
}

/** An AxiosError carrying a response with the given status. */
function axiosErrorWithStatus(status: number): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`)
  error.response = { status } as AxiosError['response']
  return error
}

describe('queryClient', () => {
  afterEach(() => {
    queryClient.clear()
  })

  it('uses the application query defaults', () => {
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: 60_000,
      retry: retryOnlyTransientFailures,
      refetchOnWindowFocus: false,
    })
  })
})

describe('retryOnlyTransientFailures', () => {
  it('retries a network error once', () => {
    const networkError = new AxiosError('Network Error')
    expect(retryOnlyTransientFailures(0, networkError)).toBe(true)
    expect(retryOnlyTransientFailures(1, networkError)).toBe(false)
  })

  it('retries a 5xx response once', () => {
    expect(retryOnlyTransientFailures(0, axiosErrorWithStatus(500))).toBe(true)
    expect(retryOnlyTransientFailures(0, axiosErrorWithStatus(503))).toBe(true)
    expect(retryOnlyTransientFailures(1, axiosErrorWithStatus(500))).toBe(false)
  })

  it('never retries a 4xx response', () => {
    // 401 especially: the Axios interceptor is already redirecting to login,
    // and a retry would fire a second doomed request into it mid-redirect.
    for (const status of [400, 401, 403, 404]) {
      expect(retryOnlyTransientFailures(0, axiosErrorWithStatus(status))).toBe(
        false
      )
    }
  })

  it('retries a non-Axios error once, since it carries no server verdict', () => {
    expect(retryOnlyTransientFailures(0, new Error('boom'))).toBe(true)
    expect(retryOnlyTransientFailures(1, new Error('boom'))).toBe(false)
  })
})

describe('handleQueryError', () => {
  beforeEach(() => mockedNotify.mockClear())

  it('shows the parsed API error by default', () => {
    handleQueryError(axiosErrorWithStatus(500), observedQuery())

    expect(mockedNotify).toHaveBeenCalledWith(
      'An error occurred, please try again later',
      'error',
      expect.objectContaining({ preventDuplicate: true })
    )
  })

  // A read whose failure has a consequence the server's wording does not name
  // supplies its own text. Falling back to parseApiError here would tell the
  // user "please try again later" when the actual fix is to reload.
  it("prefers the query's own errorMessage over the parsed one", () => {
    handleQueryError(
      axiosErrorWithStatus(500),
      observedQuery({ errorMessage: 'OpDivs are unavailable.' })
    )

    expect(mockedNotify).toHaveBeenCalledWith(
      'OpDivs are unavailable.',
      'error',
      expect.anything()
    )
  })

  // suppressErrorNotification wins: a query that renders its failure inline
  // has no use for fixed text either.
  it('stays silent when the query suppresses notifications', () => {
    handleQueryError(
      axiosErrorWithStatus(500),
      observedQuery({
        suppressErrorNotification: true,
        errorMessage: 'OpDivs are unavailable.',
      })
    )

    expect(mockedNotify).not.toHaveBeenCalled()
  })
})
