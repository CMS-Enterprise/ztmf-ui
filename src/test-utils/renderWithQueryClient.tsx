import { render, type RenderOptions } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { createTestQueryClient } from './createTestQueryClient'

/**
 * Renders a component under a QueryClientProvider and nothing else. For suites
 * that mock `react-router-dom` or notistack themselves and so cannot use
 * `renderWithProviders`, but still render something that reads server state
 * through TanStack Query. A fresh client per render keeps cached lists from
 * leaking between tests; retries are off so a failed load settles at once.
 *
 * @param ui - The component under test.
 * @param options - RTL render options, minus `wrapper`.
 * @returns The RTL render result plus the client, for cache assertions.
 */
export function renderWithQueryClient(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {}
) {
  const queryClient = createTestQueryClient()
  const result = render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    ...options,
  })
  return { ...result, queryClient }
}
