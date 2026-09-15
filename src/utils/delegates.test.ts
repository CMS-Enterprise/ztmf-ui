import MockAdapter from 'axios-mock-adapter'
import { apiPaths } from '@/api/keys'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  const { handleAuthError } = require('@/utils/authInterceptor')
  const instance = axios.create({ baseURL: 'api/v1/' })
  instance.interceptors.response.use(
    (response: unknown) => response,
    handleAuthError
  )
  return { __esModule: true, default: instance }
})

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), revalidate: jest.fn(), state: {} },
}))

import axiosInstance from '@/axiosConfig'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import { queryKeys } from '@/api/keys'
import {
  addSystemDelegate,
  useDelegateCandidates,
  useRemoveSystemDelegate,
  useSetOpDivDelegateEnabled,
  useSystemDelegates,
} from './delegates'

const mock = new MockAdapter(axiosInstance)

afterEach(() => {
  mock.reset()
})

test('lets the caller handle a capability-off add rejection', async () => {
  const body = { email: 'delegate@example.com' }
  mock.onPost(apiPaths.fismaSystems.delegates(42)).reply(403, {
    code: 'DELEGATE_NOT_ENABLED',
  })

  await expect(addSystemDelegate(42, body)).rejects.toMatchObject({
    response: { status: 403 },
  })

  expect(mock.history.post).toHaveLength(1)
  expect(mock.history.post[0].skipAuthHandling).toBe(true)
})

describe('useDelegateCandidates', () => {
  it('keeps the previous list on screen while a new search term loads', async () => {
    const url = apiPaths.fismaSystems.delegateCandidates(42)
    mock
      .onGet(url, { params: { q: 'ta' } })
      .reply(200, { data: [{ userid: 'c-1', fullname: 'Tarkin', email: 't' }] })
    mock.onGet(url, { params: { q: 'tar' } }).reply(200, {
      data: [{ userid: 'c-2', fullname: 'Tarkin II', email: 'u' }],
    })
    const client = createTestQueryClient()
    let search = 'ta'

    const { result, rerender } = renderHook(
      () => useDelegateCandidates(42, search),
      { wrapper: queryWrapper(client) }
    )
    await waitFor(() => expect(result.current.data?.[0].userid).toBe('c-1'))

    search = 'tar'
    rerender()
    // A new key with no data of its own would otherwise render an empty
    // picker for a beat; the previous term's rows hold until the new ones land.
    expect(result.current.data?.[0].userid).toBe('c-1')
    await waitFor(() => expect(result.current.data?.[0].userid).toBe('c-2'))
  })

  it("drops them on a change of system, so one system never shows another's", async () => {
    mock
      .onGet(apiPaths.fismaSystems.delegateCandidates(42), {
        params: { q: 'ta' },
      })
      .reply(200, { data: [{ userid: 'c-1', fullname: 'Tarkin', email: 't' }] })
    mock
      .onGet(apiPaths.fismaSystems.delegateCandidates(43), {
        params: { q: 'ta' },
      })
      .reply(200, { data: [{ userid: 'c-9', fullname: 'Veers', email: 'v' }] })
    const client = createTestQueryClient()
    let systemId = 42

    const { result, rerender } = renderHook(
      () => useDelegateCandidates(systemId, 'ta'),
      { wrapper: queryWrapper(client) }
    )
    await waitFor(() => expect(result.current.data?.[0].userid).toBe('c-1'))

    systemId = 43
    rerender()

    // Attaching a candidate posts to the system in the path, so showing 42's
    // people under 43 would write a delegate to the wrong system. The picker
    // blanks instead until 43's own list lands.
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.data?.[0].userid).toBe('c-9'))
  })
})

describe('delegate reads', () => {
  it('refetch on a remount, since other pages edit the roster without invalidating', async () => {
    const rosterUrl = apiPaths.fismaSystems.delegates(42)
    mock.onGet(rosterUrl).reply(200, { data: [] })
    const client = createTestQueryClient()
    const wrapper = queryWrapper(client)

    const first = renderHook(() => useSystemDelegates(42), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    // A role edit or a system assignment on another page moves someone on or
    // off this roster and invalidates nothing, so the generic stale window
    // would serve a roster the server no longer has.
    const second = renderHook(() => useSystemDelegates(42), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(mock.history.get.filter((g) => g.url === rosterUrl)).toHaveLength(2)
  })
})

describe('delegate writes', () => {
  it('invalidate both the roster and every cached candidate list', async () => {
    mock.onDelete(apiPaths.fismaSystems.delegate(42, 'd-1')).reply(204)
    const client = createTestQueryClient()
    client.setQueryData(queryKeys.fismaSystems.delegates(42), [])
    client.setQueryData(queryKeys.fismaSystems.delegateCandidates(42, ''), [])
    client.setQueryData(queryKeys.fismaSystems.delegateCandidates(42, 'ta'), [])

    const { result } = renderHook(() => useRemoveSystemDelegate(42), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {
      await result.current.mutateAsync('d-1')
    })

    // Removing someone makes them eligible again, so a stale candidate list
    // under any search term would offer the wrong people.
    const stale = (key: readonly unknown[]) =>
      client.getQueryState(key)?.isInvalidated
    expect(stale(queryKeys.fismaSystems.delegates(42))).toBe(true)
    expect(stale(queryKeys.fismaSystems.delegateCandidates(42, ''))).toBe(true)
    expect(stale(queryKeys.fismaSystems.delegateCandidates(42, 'ta'))).toBe(
      true
    )
  })

  it('resolve only once the roster has refetched, not merely started to', async () => {
    const rosterUrl = apiPaths.fismaSystems.delegates(42)
    // The roster still lists the delegate on the first read and is empty on
    // the refetch, so the cache contents say which one the write waited for.
    mock
      .onGet(rosterUrl)
      .replyOnce(200, { data: [{ userid: 'd-1', fullname: 'Tarkin' }] })
      .onGet(rosterUrl)
      .replyOnce(200, { data: [] })
    mock.onDelete(apiPaths.fismaSystems.delegate(42, 'd-1')).reply(204)
    const client = createTestQueryClient()
    const wrapper = queryWrapper(client)

    const roster = renderHook(() => useSystemDelegates(42), { wrapper })
    await waitFor(() => expect(roster.result.current.data).toHaveLength(1))

    const { result } = renderHook(() => useRemoveSystemDelegate(42), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync('d-1')
      // Asserted at the moment the write resolves, with no waitFor to paper
      // over the ordering. The section closes its dialog and toasts here, and
      // it has to be over the refreshed roster.
      expect(client.getQueryData(queryKeys.fismaSystems.delegates(42))).toEqual(
        []
      )
    })
  })

  it('the OpDiv delegate toggle invalidates the shared OpDiv list', async () => {
    // The capability flag lives on the OpDiv row that Title holds for every
    // consumer, so the grid must refetch after the write.
    mock
      .onPut(apiPaths.opdivs.systemDelegateEnabled(3))
      .reply(200, { data: {} })
    const client = createTestQueryClient()
    client.setQueryData(queryKeys.opdivs.list(true), [])

    const { result } = renderHook(() => useSetOpDivDelegateEnabled(), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {
      await result.current.mutateAsync({ opdivId: 3, enabled: true })
    })

    expect(
      client.getQueryState(queryKeys.opdivs.list(true))?.isInvalidated
    ).toBe(true)
  })
})
