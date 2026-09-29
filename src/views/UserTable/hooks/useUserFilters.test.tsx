import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useUserFilters } from './useUserFilters'

const wrapper = (entry: string) => {
  const RouterWrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  )
  RouterWrapper.displayName = 'RouterWrapper'
  return RouterWrapper
}

describe('useUserFilters OpDiv deep link', () => {
  it('seeds the OpDiv facet from ?opdiv=', () => {
    const { result } = renderHook(() => useUserFilters(), {
      wrapper: wrapper('/users?opdiv=9'),
    })
    expect(result.current.opdivFilter).toBe(9)
  })

  it('seeds a number, not a string, so the grant check can match', () => {
    // Rows are filtered with assignedopdivids.includes(opdivFilter), and that
    // array holds numbers - a string '9' would match nothing and render an
    // empty table that looks like a broken page rather than a filter.
    const { result } = renderHook(() => useUserFilters(), {
      wrapper: wrapper('/users?opdiv=9'),
    })
    expect(typeof result.current.opdivFilter).toBe('number')
  })

  it('falls back to all when the param is absent', () => {
    const { result } = renderHook(() => useUserFilters(), {
      wrapper: wrapper('/users'),
    })
    expect(result.current.opdivFilter).toBe('all')
  })

  it('falls back to all for an unparseable param', () => {
    // A hand-edited or stale link should show the full roster, not filter to
    // an id that matches nothing.
    for (const entry of [
      '/users?opdiv=abc',
      '/users?opdiv=',
      '/users?opdiv=9x',
    ]) {
      const { result } = renderHook(() => useUserFilters(), {
        wrapper: wrapper(entry),
      })
      expect(result.current.opdivFilter).toBe('all')
    }
  })
})
