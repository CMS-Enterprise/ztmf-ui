import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one. The production module
// reads import.meta.env at load time, which throws under @swc/jest.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import axiosInstance from '@/axiosConfig'
import {
  fetchOpDivs,
  createOpDiv,
  updateOpDiv,
  useOpDivs,
  useCreateOpDiv,
  useUpdateOpDiv,
} from './opdivs'
import type { OpDiv } from '@/types'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const ROWS: OpDiv[] = [
  {
    opdiv_id: 1,
    code: 'CMS',
    name: 'Centers for Medicare & Medicaid Services',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
  },
  {
    opdiv_id: 2,
    code: 'RETIRED',
    name: 'Deactivated OpDiv',
    is_parent: false,
    active: false,
    system_delegate_enabled: false,
  },
]

describe('fetchOpDivs', () => {
  it('unwraps the { data: [...] } envelope', async () => {
    mock.onGet('/opdivs').reply(200, { data: ROWS })
    await expect(fetchOpDivs()).resolves.toEqual(ROWS)
  })

  it('defaults to active-only and sends active_only=false for the superset', async () => {
    mock.onGet('/opdivs').reply(200, { data: ROWS })

    await fetchOpDivs()
    expect(mock.history.get[0].params).toBeUndefined()

    await fetchOpDivs(true)
    expect(mock.history.get[1].params).toEqual({ active_only: false })
  })

  it('coerces a null payload to an empty array', async () => {
    mock.onGet('/opdivs').reply(200, { data: null })
    await expect(fetchOpDivs(true)).resolves.toEqual([])
  })

  it('resolves an empty list as-is - empty is an answer, not a failure', async () => {
    mock.onGet('/opdivs').reply(200, { data: [] })
    await expect(fetchOpDivs(true)).resolves.toEqual([])
  })

  it('rejects on a server error', async () => {
    mock.onGet('/opdivs').reply(500)
    await expect(fetchOpDivs()).rejects.toBeDefined()
  })

  it('rejects on a network error', async () => {
    mock.onGet('/opdivs').networkError()
    await expect(fetchOpDivs()).rejects.toBeDefined()
  })
})

describe('createOpDiv', () => {
  it('posts the input and returns the created row', async () => {
    mock.onPost('/opdivs').reply(201, { data: ROWS[0] })
    await expect(createOpDiv({ code: 'CMS', name: 'CMS' })).resolves.toEqual(
      ROWS[0]
    )
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      code: 'CMS',
      name: 'CMS',
    })
  })
})

describe('updateOpDiv', () => {
  it('puts to the id-scoped path (204, no body)', async () => {
    mock.onPut('/opdivs/2').reply(204)
    await expect(
      updateOpDiv(2, {
        code: 'RETIRED',
        name: 'Deactivated OpDiv',
        active: false,
      })
    ).resolves.toBeUndefined()
    expect(mock.history.put[0].url).toBe('/opdivs/2')
  })
})

describe('useOpDivs', () => {
  it('returns the rows, forwards the signal, and reports the list loaded', async () => {
    mock.onGet('/opdivs').reply(200, { data: ROWS })
    const client = createTestQueryClient()

    const { result } = renderHook(() => useOpDivs(true), {
      wrapper: queryWrapper(client),
    })

    expect(result.current.opdivsLoaded).toBe(false)
    await waitFor(() => expect(result.current.opdivs).toEqual(ROWS))
    expect(result.current.opdivsLoaded).toBe(true)
    expect(mock.history.get[0].params).toEqual({ active_only: false })
    expect(mock.history.get[0].signal).toBeDefined()
  })

  it('does not fetch while disabled and reports the list not loaded', async () => {
    mock.onGet('/opdivs').reply(200, { data: ROWS })
    const client = createTestQueryClient()

    const { result } = renderHook(() => useOpDivs(true, { enabled: false }), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {})

    expect(mock.history.get).toHaveLength(0)
    expect(result.current.opdivsLoaded).toBe(false)
    expect(result.current.opdivs).toEqual([])
  })
})

describe('OpDiv mutations', () => {
  it('useCreateOpDiv posts, then refetches the shared list', async () => {
    mock.onGet('/opdivs').reply(200, { data: ROWS })
    mock.onPost('/opdivs').reply(201, { data: ROWS[0] })
    const wrapper = queryWrapper(createTestQueryClient())
    const list = renderHook(() => useOpDivs(true), { wrapper })
    await waitFor(() => expect(list.result.current.opdivsLoaded).toBe(true))

    const { result } = renderHook(() => useCreateOpDiv(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ code: 'NEW', name: 'New OpDiv' })
    })

    expect(mock.history.post).toHaveLength(1)
    // The invalidation reaches the mounted list, which refetches.
    await waitFor(() => expect(mock.history.get).toHaveLength(2))
  })

  it('useUpdateOpDiv puts to the id path, then refetches the shared list', async () => {
    mock.onGet('/opdivs').reply(200, { data: ROWS })
    mock.onPut('/opdivs/2').reply(204)
    const wrapper = queryWrapper(createTestQueryClient())
    const list = renderHook(() => useOpDivs(true), { wrapper })
    await waitFor(() => expect(list.result.current.opdivsLoaded).toBe(true))

    const { result } = renderHook(() => useUpdateOpDiv(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        opdivId: 2,
        input: { code: 'RETIRED', name: 'Deactivated OpDiv', active: true },
      })
    })

    await waitFor(() => expect(mock.history.get).toHaveLength(2))
  })
})
