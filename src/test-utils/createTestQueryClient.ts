import type { QueryClient } from '@tanstack/react-query'
import { createQueryClient } from '@/queryClient'

/**
 * Builds a QueryClient for a single test. It keeps the production cache and
 * error behavior from `createQueryClient` while disabling retries, so an
 * expected failure settles on the first attempt instead of waiting through
 * the transient-failure retry. Create one per test rather than sharing, so
 * cached server state cannot leak between cases.
 *
 * @returns A fresh client with retries disabled for queries and mutations.
 */
export function createTestQueryClient(): QueryClient {
  return createQueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}
