import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import { act, renderHook } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import { queryKeys } from '@/api/keys'
import axiosInstance from '@/axiosConfig'
import { createDatacall, useCreateDatacall } from './datacalls'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const INPUT = { datacall: 'FY2027 ZTM', deadline: '2027-09-30T23:59:59.000Z' }

describe('createDatacall', () => {
  it('posts the name and deadline as given', async () => {
    mock.onPost('/datacalls').reply(201)

    await expect(createDatacall(INPUT)).resolves.toBeUndefined()

    expect(mock.history.post).toHaveLength(1)
    expect(JSON.parse(mock.history.post[0].data)).toEqual(INPUT)
  })
})

describe('useCreateDatacall', () => {
  it('invalidates every cached data-call list on success', async () => {
    mock.onPost('/datacalls').reply(201)
    const client = createTestQueryClient()
    // Two entries under the same prefix, so the assertion proves the whole
    // prefix is invalidated rather than one exact key.
    client.setQueryData(queryKeys.datacalls.all, [])
    client.setQueryData(queryKeys.datacalls.list(), [])

    const { result } = renderHook(() => useCreateDatacall(), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {
      await result.current.mutateAsync(INPUT)
    })

    const stale = (key: readonly unknown[]) =>
      client.getQueryState(key)?.isInvalidated
    expect(stale(queryKeys.datacalls.all)).toBe(true)
    expect(stale(queryKeys.datacalls.list())).toBe(true)
  })

  it('does not invalidate when the write fails', async () => {
    mock
      .onPost('/datacalls')
      .reply(400, { data: { datacall: 'already exists' } })
    const client = createTestQueryClient()
    client.setQueryData(queryKeys.datacalls.list(), [])

    const { result } = renderHook(() => useCreateDatacall(), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {
      await expect(result.current.mutateAsync(INPUT)).rejects.toBeDefined()
    })

    // A rejected create leaves the picker alone; the caller renders the
    // field error and the dialog stays open on the unchanged list.
    expect(
      client.getQueryState(queryKeys.datacalls.list())?.isInvalidated
    ).toBe(false)
  })
})
