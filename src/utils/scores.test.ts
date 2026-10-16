import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
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
import {
  fetchScoreAggregates,
  fetchScoreProgress,
  useDatacallAggregates,
  useDatacallProgress,
} from './scores'

const mock = new MockAdapter(axiosInstance)
const mockedNotify = notify as jest.Mock
afterEach(() => mock.reset())
beforeEach(() => mockedNotify.mockClear())

const aggUrl = (id: number) => `/scores/aggregate?datacallid=${id}`
const progUrl = (id: number) => `/scores/progress?datacallid=${id}`

describe('score fetchers', () => {
  it('unwrap the envelope and coerce null to an empty list', async () => {
    mock.onGet(aggUrl(1)).reply(200, { data: null })
    mock.onGet(progUrl(1)).reply(200, { data: null })

    await expect(fetchScoreAggregates({ datacallId: 1 })).resolves.toEqual([])
    await expect(fetchScoreProgress(1)).resolves.toEqual([])
  })
})

describe('useDatacallAggregates and useDatacallProgress', () => {
  it('keeps the rest of the batch when one call fails', async () => {
    mock.onGet(aggUrl(1)).reply(200, { data: [{ fismasystemid: 11 }] })
    mock.onGet(aggUrl(2)).reply(500)
    mock.onGet(progUrl(1)).reply(200, { data: [{ fismasystemid: 11 }] })
    mock.onGet(progUrl(2)).reply(200, { data: [{ fismasystemid: 22 }] })

    const wrapper = queryWrapper(createTestQueryClient())
    const agg = renderHook(() => useDatacallAggregates([1, 2]), { wrapper })
    const prog = renderHook(() => useDatacallProgress([1, 2]), { wrapper })

    await waitFor(() => expect(agg.result.current.isPending).toBe(false))
    await waitFor(() => expect(prog.result.current.isPending).toBe(false))
    // The failed call resolves to an empty list in its own slot rather than
    // sinking the batch, so the calls that answered still render.
    expect(agg.result.current.scoresPerCall[0]).toHaveLength(1)
    expect(agg.result.current.scoresPerCall[1]).toEqual([])
    expect(prog.result.current.progressPerCall[1]).toHaveLength(1)
  })

  it('returns per-call rows in the order the ids were given', async () => {
    mock.onGet(aggUrl(7)).reply(200, { data: [{ fismasystemid: 77 }] })
    mock.onGet(aggUrl(8)).reply(200, { data: [] })
    mock.onGet(progUrl(7)).reply(200, { data: [] })
    mock.onGet(progUrl(8)).reply(200, { data: [{ fismasystemid: 88 }] })

    const wrapper = queryWrapper(createTestQueryClient())
    const agg = renderHook(() => useDatacallAggregates([7, 8]), { wrapper })
    const prog = renderHook(() => useDatacallProgress([7, 8]), { wrapper })

    await waitFor(() => expect(agg.result.current.isPending).toBe(false))
    await waitFor(() => expect(prog.result.current.isPending).toBe(false))
    // buildDashboardMaps zips these against the id array, so a reordering
    // would silently attribute one call's scores to another.
    expect(agg.result.current.scoresPerCall[0]).toHaveLength(1)
    expect(prog.result.current.progressPerCall[1]).toHaveLength(1)
  })
})

// FismaTable rebuilds its rows from the maps the dashboard derives from
// this, so a fresh object every render makes every checkbox click recompute
// the grid.
it('returns the same object across renders while the data is unchanged', async () => {
  mock.onGet(aggUrl(3)).reply(200, { data: [{ fismasystemid: 33 }] })
  mock.onGet(progUrl(3)).reply(200, { data: [] })

  const { result, rerender } = renderHook(() => useDatacallAggregates([3]), {
    wrapper: queryWrapper(createTestQueryClient()),
  })

  await waitFor(() => expect(result.current.isPending).toBe(false))
  const first = result.current
  rerender()
  rerender()
  expect(result.current.scoresPerCall).toBe(first.scoresPerCall)
})

// isInitialLoad drives a spinner that replaces the whole dashboard, so it has
// to mean "nothing to show yet", not "a read is in flight". Switching another
// call on would otherwise unmount the table and lose the user's filters.
it('reports isInitialLoad false once one call has answered', async () => {
  mock.onGet(aggUrl(1)).reply(200, { data: [{ fismasystemid: 11 }] })
  mock.onGet(progUrl(1)).reply(200, { data: [] })
  // The second call never answers, standing in for one just switched on.
  mock.onGet(aggUrl(2)).reply(() => new Promise(() => {}))
  mock.onGet(progUrl(2)).reply(() => new Promise(() => {}))

  const { result, rerender } = renderHook(
    ({ ids }) => useDatacallAggregates(ids),
    {
      wrapper: queryWrapper(createTestQueryClient()),
      initialProps: { ids: [1] },
    }
  )
  await waitFor(() => expect(result.current.isInitialLoad).toBe(false))

  rerender({ ids: [1, 2] })

  // isPending is true (call 2 is in flight) but there is something to show.
  expect(result.current.isPending).toBe(true)
  expect(result.current.isInitialLoad).toBe(false)
  expect(result.current.scoresPerCall[0]).toHaveLength(1)
})

describe('score query options', () => {
  // The dashboard renders an unscored system the same way whether the read
  // failed or the system has no score, and the fan-out means one bad call
  // would toast on every visit. The code this replaced only logged.
  it('keep a failed read out of the global snackbar', async () => {
    mock.onGet(aggUrl(1)).reply(500)
    mock.onGet(progUrl(1)).reply(500)

    const wrapper = queryWrapper(createTestQueryClient())
    const agg = renderHook(() => useDatacallAggregates([1]), { wrapper })
    const prog = renderHook(() => useDatacallProgress([1]), { wrapper })

    await waitFor(() => expect(agg.result.current.isPending).toBe(false))
    await waitFor(() => expect(prog.result.current.isPending).toBe(false))
    expect(mockedNotify).not.toHaveBeenCalled()
  })
})
