import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: 'api/v1/' }) }
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import axiosInstance from '@/axiosConfig'
import { queryKeys } from '@/api/keys'
import {
  fetchUserOpDivs,
  setUserOpDivs,
  useUserOpDivs,
  useSetUserOpDivs,
} from './userOpdivs'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const USER = '11111111-1111-1111-1111-111111111111'
const GRANTS_URL = `/users/${USER}/assignedopdivs`

describe('fetchUserOpDivs', () => {
  it('unwraps the envelope, coerces null to an empty list, and forwards the signal', async () => {
    mock.onGet(GRANTS_URL).replyOnce(200, { data: [1, 2] })
    await expect(
      fetchUserOpDivs(USER, new AbortController().signal)
    ).resolves.toEqual([1, 2])
    expect(mock.history.get[0].signal).toBeDefined()

    mock.onGet(GRANTS_URL).replyOnce(200, { data: null })
    await expect(fetchUserOpDivs(USER)).resolves.toEqual([])
  })
})

describe('setUserOpDivs', () => {
  it('puts the full desired set', async () => {
    mock.onPut(`/users/${USER}/opdivs`).reply(204)
    await expect(setUserOpDivs(USER, [1, 3])).resolves.toBeUndefined()
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ opdiv_ids: [1, 3] })
  })
})

describe('useUserOpDivs', () => {
  it('refetches each time it is re-enabled, so an open always reads fresh grants', async () => {
    mock
      .onGet(GRANTS_URL)
      .replyOnce(200, { data: [1] })
      .onGet(GRANTS_URL)
      .replyOnce(200, { data: [1, 2] })
    const client = createTestQueryClient()
    let enabled = true

    const { result, rerender } = renderHook(
      () => useUserOpDivs(USER, { enabled }),
      { wrapper: queryWrapper(client) }
    )
    await waitFor(() => expect(result.current.data).toEqual([1]))

    // The modal toggles enabled rather than unmounting; a stale time of zero
    // is what turns the second enable into a request instead of a cache hit.
    enabled = false
    rerender()
    enabled = true
    rerender()

    await waitFor(() => expect(result.current.data).toEqual([1, 2]))
    expect(mock.history.get).toHaveLength(2)
  })
})

describe('useUserOpDivs on reconnect', () => {
  it('does not refetch when the browser comes back online', async () => {
    mock.onGet(GRANTS_URL).reply(200, { data: [1] })
    const client = createTestQueryClient()

    const { result } = renderHook(() => useUserOpDivs(USER), {
      wrapper: queryWrapper(client),
    })
    await waitFor(() => expect(result.current.data).toEqual([1]))

    // The modal reads any in-flight fetch as its initial load and blanks the
    // picker, so a reconnect refetch would discard the user's edits.
    act(() => {
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })
    await act(async () => {})

    expect(mock.history.get).toHaveLength(1)
    expect(result.current.isFetching).toBe(false)
  })
})

describe('useSetUserOpDivs', () => {
  it('invalidates the user grant entry on save rather than seeding it', async () => {
    mock.onPut(`/users/${USER}/opdivs`).reply(204)
    const client = createTestQueryClient()
    const key = queryKeys.users.assignedOpdivs(USER)
    client.setQueryData(key, [1, 5])

    const { result } = renderHook(() => useSetUserOpDivs(), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {
      await result.current.mutateAsync({ userid: USER, opdivIds: [1] })
    })

    // A scoped admin's body carries only the OpDivs they hold, and the backend
    // keeps the target's other grants, so the body is not the stored set. The
    // entry must be marked for refetch, not overwritten with the subset.
    expect(client.getQueryData(key)).toEqual([1, 5])
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })
})
