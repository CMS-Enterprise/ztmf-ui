import MockAdapter from 'axios-mock-adapter'

jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import { renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import axiosInstance from '@/axiosConfig'
import { notify } from '@/utils/notify'
import { fetchSystemInsights, useSystemInsights } from './insights'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())
beforeEach(() => (notify as jest.Mock).mockClear())

const payload = { summary: 'x' }

describe('fetchSystemInsights', () => {
  it('keys payloads by questionid and drops incomplete rows', async () => {
    mock.onGet('/insights', { params: { fismasystemid: 7 } }).reply(200, {
      data: [
        { questionid: 1, payload },
        { questionid: 2, payload: null },
        { questionid: null, payload },
      ],
    })
    const map = await fetchSystemInsights(7)
    expect([...map.keys()]).toEqual([1])
    expect(map.get(1)).toEqual(payload)
  })

  it('reads a null envelope as no insights', async () => {
    mock.onGet('/insights').reply(200, { data: null })
    await expect(fetchSystemInsights(7)).resolves.toEqual(new Map())
  })
})

describe('useSystemInsights', () => {
  it('does not fetch or settle without a system', () => {
    const wrapper = queryWrapper(createTestQueryClient())
    const { result } = renderHook(() => useSystemInsights(undefined), {
      wrapper,
    })
    expect(result.current.settled).toBe(false)
    expect(result.current.insightsByQuestion.size).toBe(0)
    expect(mock.history.get).toHaveLength(0)
  })

  it('settles on a failure with an empty map, no toast and no retry', async () => {
    mock.onGet('/insights').reply(500)
    const wrapper = queryWrapper(createTestQueryClient())
    const { result } = renderHook(() => useSystemInsights(7), { wrapper })
    await waitFor(() => expect(result.current.settled).toBe(true))
    expect(result.current.insightsByQuestion.size).toBe(0)
    expect(notify).not.toHaveBeenCalled()
    expect(mock.history.get).toHaveLength(1)
  })

  it('does not carry insights from one system to the next', async () => {
    mock
      .onGet('/insights', { params: { fismasystemid: 7 } })
      .reply(200, { data: [{ questionid: 1, payload }] })
    mock
      .onGet('/insights', { params: { fismasystemid: 8 } })
      .reply(() => new Promise(() => {}))
    const wrapper = queryWrapper(createTestQueryClient())
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useSystemInsights(id),
      { wrapper, initialProps: { id: 7 } }
    )
    await waitFor(() => expect(result.current.insightsByQuestion.size).toBe(1))
    rerender({ id: 8 })
    expect(result.current.settled).toBe(false)
    expect(result.current.insightsByQuestion.size).toBe(0)
  })
})
