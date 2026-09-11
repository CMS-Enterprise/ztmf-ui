import {
  QueryCache,
  QueryClient,
  type Query,
  type QueryClientConfig,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { isAxiosError, isCancel } from 'axios'
import { isAuthHandled, notify } from '@/utils/notify'
import { parseApiError } from '@/utils/apiErrors'

declare module '@tanstack/react-query' {
  interface Register {
    /**
     * Set when a query renders its failure inline and a global snackbar would
     * duplicate that error surface.
     */
    queryMeta: {
      suppressErrorNotification?: boolean
    }
  }
}

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
 * Surfaces unhandled query failures once at the cache boundary. Authentication
 * errors already handled by the Axios interceptor, cancellations, unobserved
 * requests, and queries with an inline error surface stay silent.
 */
export function handleQueryError(
  error: unknown,
  query: Query<unknown, unknown>
): void {
  if (
    isAuthHandled(error) ||
    isCancel(error) ||
    query.meta?.suppressErrorNotification === true ||
    query.getObserversCount() === 0
  ) {
    return
  }

  notify(parseApiError(error).message, 'error', {
    key: query.queryHash,
    preventDuplicate: true,
  })
}

/**
 * Creates an application QueryClient. Tests use this factory with retry
 * overrides so they retain production cache/error behavior without sharing
 * cached state or waiting through retries.
 */
export function createQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    ...config,
    queryCache:
      config.queryCache ??
      new QueryCache({
        onError: handleQueryError,
      }),
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        staleTime: 60_000,
        retry: retryOnlyTransientFailures,
        refetchOnWindowFocus: false,
        ...config.defaultOptions?.queries,
      },
    },
  })
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
const queryClient = createQueryClient()

/**
 * Cache policy for reference vocabularies: system attributes, datacenter
 * environments, and OpDivs. They change a few times a year, so one load per
 * session is the right amount of network.
 *
 * `gcTime` matters as much as `staleTime`. Several consumers live inside
 * modals that unmount, and the default five-minute collection would drop the
 * entry and refetch on the next open, which is the re-request on navigation
 * this policy exists to prevent. A failed load stays silent at the cache
 * boundary because every consumer already renders around an empty list, and
 * a query with no data is always stale, so the next mount retries anyway.
 *
 * Writes that change a vocabulary must invalidate its key explicitly; nothing
 * here will pick the change up on its own.
 */
export const vocabularyQueryOptions = {
  staleTime: Infinity,
  gcTime: Infinity,
  meta: { suppressErrorNotification: true },
} satisfies Pick<UseQueryOptions, 'staleTime' | 'gcTime' | 'meta'>

/**
 * Options accepted by the vocabulary hooks. `enabled` defers the request, for
 * the layout that must not fetch before the session loader has authenticated.
 */
export type VocabularyQueryHookOptions = { enabled?: boolean }

export default queryClient
