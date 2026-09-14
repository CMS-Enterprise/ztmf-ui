import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: 'api/v1/' }) }
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import axiosInstance from '@/axiosConfig'
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

describe('useSetUserOpDivs', () => {
  it('seeds the cache with the saved set so a disabled reader repaints without a request', async () => {
    mock.onPut(`/users/${USER}/opdivs`).reply(204)
    const wrapper = queryWrapper(createTestQueryClient())
    const reader = renderHook(() => useUserOpDivs(USER, { enabled: false }), {
      wrapper,
    })

    const { result } = renderHook(() => useSetUserOpDivs(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ userid: USER, opdivIds: [3, 4] })
    })

    await waitFor(() => expect(reader.result.current.data).toEqual([3, 4]))
    expect(mock.history.get).toHaveLength(0)
  })
})
