import { createElement, type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'

/**
 * Wrapper for `renderHook`: mounts the hook under a QueryClientProvider for
 * the given client. Built with createElement rather than JSX so hook suites
 * can stay `.ts` files alongside the pure-function tests they share fixtures
 * with. Pair it with `createTestQueryClient` for a retry-free client per test.
 *
 * @param client - The QueryClient the hook under test should read from.
 * @returns A wrapper component for `renderHook`'s `wrapper` option.
 */
export function queryWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
}
