import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { ReactElement } from 'react'

/**
 * Wraps a view in the providers it needs at runtime so component tests
 * exercise the real notistack and React Router stack. Useful for the
 * 403 path because notistack v3's standalone enqueueSnackbar dispatches
 * to whichever SnackbarProvider is mounted - here that is our test
 * provider, so snackbars land in the rendered DOM and are queryable.
 *
 * Caveat for 401 tests: the axios interceptor calls
 * `router.navigate(...)` on the production hash router instance, not on
 * the MemoryRouter rendered here. Tests that assert the 401 redirect
 * should `jest.mock('@/router/router')` and assert on the spy instead
 * of looking for a rendered LoginPage.
 *
 * @param ui - The component under test.
 * @param options - Optional MemoryRouter initial entries and RTL render options.
 * @returns The RTL render result.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: {
    initialEntries?: MemoryRouterProps['initialEntries']
  } & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { initialEntries, ...renderOptions } = options
  return render(ui, {
    wrapper: ({ children }) => (
      <SnackbarProvider>
        <MemoryRouter initialEntries={initialEntries ?? ['/']}>
          {children}
        </MemoryRouter>
      </SnackbarProvider>
    ),
    ...renderOptions,
  })
}
