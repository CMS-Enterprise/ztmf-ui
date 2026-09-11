import { AxiosError } from 'axios'
import queryClient, { retryOnlyTransientFailures } from './queryClient'

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
