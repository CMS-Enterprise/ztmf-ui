import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

/**
 * Retry transient failures once; never retry a definitive server answer.
 *
 * Network errors and 5xx responses are worth a single retry because the next
 * attempt can genuinely succeed. Any response below 500 is the server telling
 * us something (401 unauthenticated, 403/404 quiet empty states) and retrying
 * would only repeat the answer. The 401 case is the sharp one: the Axios
 * interceptor reacts to it by navigating to the login flow, so a blanket
 * `retry: 1` would fire a second doomed request into the interceptor while
 * that redirect is already underway.
 */
export function retryOnlyTransientFailures(
  failureCount: number,
  error: Error
): boolean {
  if (failureCount >= 1) return false
  if (isAxiosError(error) && error.response && error.response.status < 500) {
    return false
  }
  return true
}

/**
 * Shared client for server state rendered by the application.
 *
 * A one-minute stale window deduplicates nearby reads while keeping admin data
 * reasonably current. Refetch-on-focus is disabled because switching between
 * this app and reference material is common in admin workflows, and each
 * return to the window should not trigger noisy, unrelated network requests or
 * loading-state changes. Explicit invalidation still refreshes data after
 * writes, while the retry policy above covers a transient failure without
 * masking an outage.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: retryOnlyTransientFailures,
      refetchOnWindowFocus: false,
    },
  },
})

export default queryClient
