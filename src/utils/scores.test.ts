import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import { renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import axiosInstance from '@/axiosConfig'
import {
  fetchScoreAggregate,
  fetchScoreProgress,
  useDashboardScores,
} from './scores'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const aggUrl = (id: number) => `/scores/aggregate?datacallid=${id}`
const progUrl = (id: number) => `/scores/progress?datacallid=${id}`

describe('score fetchers', () => {
  it('unwrap the envelope and coerce null to an empty list', async () => {
    mock.onGet(aggUrl(1)).reply(200, { data: null })
    mock.onGet(progUrl(1)).reply(200, { data: null })

    await expect(fetchScoreAggregate(1)).resolves.toEqual([])
    await expect(fetchScoreProgress(1)).resolves.toEqual([])
  })
})

describe('useDashboardScores', () => {
  it('keeps the rest of the batch when one call fails', async () => {
    mock.onGet(aggUrl(1)).reply(200, { data: [{ fismasystemid: 11 }] })
    mock.onGet(aggUrl(2)).reply(500)
    mock.onGet(progUrl(1)).reply(200, { data: [{ fismasystemid: 11 }] })
    mock.onGet(progUrl(2)).reply(200, { data: [{ fismasystemid: 22 }] })

    const { result } = renderHook(() => useDashboardScores([1, 2]), {
      wrapper: queryWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // The failed call resolves to an empty list in its own slot rather than
    // sinking the batch, so the calls that answered still render.
    expect(result.current.scoresPerCall[0]).toHaveLength(1)
    expect(result.current.scoresPerCall[1]).toEqual([])
    expect(result.current.progressPerCall[1]).toHaveLength(1)
  })

  it('returns per-call rows in the order the ids were given', async () => {
    mock.onGet(aggUrl(7)).reply(200, { data: [{ fismasystemid: 77 }] })
    mock.onGet(aggUrl(8)).reply(200, { data: [] })
    mock.onGet(progUrl(7)).reply(200, { data: [] })
    mock.onGet(progUrl(8)).reply(200, { data: [{ fismasystemid: 88 }] })

    const { result } = renderHook(() => useDashboardScores([7, 8]), {
      wrapper: queryWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // buildDashboardMaps zips these against the id array, so a reordering
    // would silently attribute one call's scores to another.
    expect(result.current.scoresPerCall[0]).toHaveLength(1)
    expect(result.current.progressPerCall[1]).toHaveLength(1)
  })
})
