import { QueryClient } from '@tanstack/react-query'

/**
 * Shared client for server state rendered by the application.
 *
 * A one-minute stale window deduplicates nearby reads while keeping admin data
 * reasonably current. Refetch-on-focus is disabled because switching between
 * this app and reference material is common in admin workflows, and each
 * return to the window should not trigger noisy, unrelated network requests or
 * loading-state changes. Explicit invalidation still refreshes data after
 * writes, while one retry covers a transient failure without masking an outage.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default queryClient
