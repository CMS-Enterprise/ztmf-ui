/**
 * Coverage for useLoadUsers's single source-of-truth contract: rows carry
 * assignedopdivids directly (backfilled in place for an older backend that
 * omits the field), so the OpDivs column and the OpDiv filter both read the
 * same value and refreshUserRow (in the parent) can never disagree with a
 * backfill that arrives late. See UserTable.tsx's filteredRows and the
 * 'opdivs' column's renderCell, both of which read row.assignedopdivids
 * alone.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/notify', () => ({
  __esModule: true,
  notify: jest.fn(),
  isAuthHandled: jest.fn(() => false),
}))

import axiosInstance from '@/axiosConfig'
import { notify } from '@/utils/notify'
import { useLoadUsers } from './useLoadUsers'
import type { users } from '@/types'

const mock = new MockAdapter(axiosInstance)
const notifyMock = notify as jest.Mock

function userRow(overrides: Partial<users> = {}): users {
  return {
    userid: '1',
    email: 'leia@rebellion.gov',
    fullname: 'Leia Organa',
    role: 'ISSO  ',
    assignedfismasystems: [],
    ...overrides,
  } as users
}

beforeEach(() => {
  mock.reset()
  notifyMock.mockClear()
})

describe('useLoadUsers', () => {
  test('loads rows and trims the role', async () => {
    mock
      .onGet('/users')
      .reply(200, { data: [userRow({ assignedopdivids: [] })] })

    const { result } = renderHook(() =>
      useLoadUsers({ canRead: true, showDeleted: false })
    )

    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.rows[0].role).toBe('ISSO')
  })

  test('does not fetch when canRead is false', async () => {
    mock.onGet('/users').reply(200, { data: [userRow()] })

    renderHook(() => useLoadUsers({ canRead: false, showDeleted: false }))
    await new Promise((r) => setTimeout(r, 0))

    expect(mock.history.get).toHaveLength(0)
  })

  test('showDeleted forwards to the deleted query param', async () => {
    mock
      .onGet('/users')
      .reply((config) => [
        200,
        { data: config.params?.deleted ? [userRow({ userid: 'del' })] : [] },
      ])

    const { result, rerender } = renderHook(
      ({ showDeleted }: { showDeleted: boolean }) =>
        useLoadUsers({ canRead: true, showDeleted }),
      { initialProps: { showDeleted: false } }
    )
    await waitFor(() => expect(mock.history.get.length).toBeGreaterThan(0))
    expect(result.current.rows).toHaveLength(0)

    rerender({ showDeleted: true })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.rows[0].userid).toBe('del')
  })

  test('a slower showDeleted request cannot overwrite the newer result', async () => {
    type UsersReply = (value: [number, { data: users[] }]) => void
    const resolvers: Partial<Record<'active' | 'deleted', UsersReply>> = {}
    const signals: Partial<Record<'active' | 'deleted', AbortSignal>> = {}
    mock.onGet('/users').reply(
      (config) =>
        new Promise((resolve) => {
          const key = config.params?.deleted ? 'deleted' : 'active'
          resolvers[key] = resolve
          signals[key] = config.signal as AbortSignal
        })
    )

    const { result, rerender } = renderHook(
      ({ showDeleted }: { showDeleted: boolean }) =>
        useLoadUsers({ canRead: true, showDeleted }),
      { initialProps: { showDeleted: false } }
    )
    await waitFor(() => expect(resolvers.active).toBeDefined())

    rerender({ showDeleted: true })
    await waitFor(() => expect(resolvers.deleted).toBeDefined())
    expect(signals.active?.aborted).toBe(true)
    expect(signals.deleted?.aborted).toBe(false)

    await act(async () => {
      resolvers.deleted?.([
        200,
        {
          data: [userRow({ userid: 'deleted-newer', assignedopdivids: [] })],
        },
      ])
    })
    await waitFor(() =>
      expect(result.current.rows[0]?.userid).toBe('deleted-newer')
    )

    await act(async () => {
      resolvers.active?.([
        200,
        { data: [userRow({ userid: 'active-older', assignedopdivids: [] })] },
      ])
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.rows[0]?.userid).toBe('deleted-newer')
  })

  test('a row that already carries assignedopdivids (even empty) triggers no per-user backfill read', async () => {
    mock
      .onGet('/users')
      .reply(200, { data: [userRow({ assignedopdivids: [] })] })

    const { result } = renderHook(() =>
      useLoadUsers({ canRead: true, showDeleted: false })
    )

    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    // Give the (absent) backfill a turn to fire if it were going to.
    await new Promise((r) => setTimeout(r, 0))
    expect(
      mock.history.get.some((c) => c.url?.includes('/assignedopdivs'))
    ).toBe(false)
    expect(result.current.rows[0].assignedopdivids).toEqual([])
  })

  test('a row omitting assignedopdivids (older backend) is backfilled from the per-user detail endpoint', async () => {
    const legacyRow = userRow({ userid: 'legacy' })
    delete (legacyRow as Partial<users>).assignedopdivids
    mock.onGet('/users').reply(200, { data: [legacyRow] })
    mock.onGet('/users/legacy/assignedopdivs').reply(200, { data: [1, 5] })

    const { result } = renderHook(() =>
      useLoadUsers({ canRead: true, showDeleted: false })
    )

    await waitFor(() =>
      expect(result.current.rows[0]?.assignedopdivids).toEqual([1, 5])
    )
  })

  test('a per-user backfill read failure defaults that row to no grants rather than blocking the table', async () => {
    const legacyRow = userRow({ userid: 'legacy' })
    delete (legacyRow as Partial<users>).assignedopdivids
    mock.onGet('/users').reply(200, { data: [legacyRow] })
    mock.onGet('/users/legacy/assignedopdivs').networkError()

    const { result } = renderHook(() =>
      useLoadUsers({ canRead: true, showDeleted: false })
    )

    await waitFor(() =>
      expect(result.current.rows[0]?.assignedopdivids).toEqual([])
    )
    // Each per-user read catches its own failure, so the table never surfaces
    // a warning for an ordinary single-user hiccup.
    expect(notifyMock).not.toHaveBeenCalled()
  })

  test('a late compatibility backfill does not clobber a row already updated by refreshUserRow', async () => {
    const legacyRow = userRow({ userid: 'legacy' })
    delete (legacyRow as Partial<users>).assignedopdivids
    mock.onGet('/users').reply(200, { data: [legacyRow] })
    // Hold the per-user backfill open so the row can be updated first, as if
    // the grant modal's onChanged (refreshUserRow) resolved ahead of it.
    let resolveBackfill: (
      value: [number, { data: number[] }]
    ) => void = () => {}
    mock.onGet('/users/legacy/assignedopdivs').reply(
      () =>
        new Promise((resolve) => {
          resolveBackfill = resolve
        })
    )

    const { result } = renderHook(() =>
      useLoadUsers({ canRead: true, showDeleted: false })
    )

    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.rows[0].assignedopdivids).toBeUndefined()

    // Simulate refreshUserRow patching the row with the authoritative,
    // newer value while the compatibility read is still in flight.
    act(() => {
      result.current.setRows((prev) =>
        prev.map((row) =>
          row.userid === 'legacy' ? { ...row, assignedopdivids: [9] } : row
        )
      )
    })
    expect(result.current.rows[0].assignedopdivids).toEqual([9])

    // Now let the stale backfill resolve; its value must not win.
    await act(async () => {
      resolveBackfill([200, { data: [1, 5] }])
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(result.current.rows[0].assignedopdivids).toEqual([9])
  })

  test('unmounting mid-fetch aborts the request and applies no state after', async () => {
    let resolveUsers: (value: [number, { data: users[] }]) => void = () => {}
    let requestSignal: AbortSignal | undefined
    mock.onGet('/users').reply(
      (config) =>
        new Promise((resolve) => {
          requestSignal = config.signal as AbortSignal
          resolveUsers = resolve
        })
    )
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = renderHook(() =>
      useLoadUsers({ canRead: true, showDeleted: false })
    )
    await waitFor(() => expect(requestSignal).toBeDefined())
    expect(requestSignal?.aborted).toBe(false)
    unmount()
    expect(requestSignal?.aborted).toBe(true)
    // Resolving after unmount must not throw or trigger a React state-update
    // warning; jest fails the suite on an uncaught rejection/console.error
    // from act() if the effect's cleanup did not guard this.
    resolveUsers([200, { data: [userRow()] }])
    await new Promise((r) => setTimeout(r, 20))
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })
})
