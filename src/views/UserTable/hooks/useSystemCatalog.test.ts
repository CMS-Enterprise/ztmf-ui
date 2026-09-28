/**
 * Coverage for useSystemCatalog's global fisma-system reads: the active list
 * and the decommissioned list are fetched once per mount from dedicated
 * /fismasystems endpoints (never from the dashboard's context list, which the
 * Show Decommissioned toggle would otherwise swap to a decommissioned-only
 * response), degrade independently on failure, and abort in flight on
 * unmount / when the caller loses read access.
 */
import { renderHook, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { useSystemCatalog } from './useSystemCatalog'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)

const ACTIVE: FismaSystemType[] = [
  {
    fismasystemid: 1,
    fismaacronym: 'DS-1',
    fismaname: 'Death Star',
    fismasubsystem: null,
  } as unknown as FismaSystemType,
]
const DECOMM: FismaSystemType[] = [
  {
    fismasystemid: 2,
    fismaacronym: 'DS-0',
    fismaname: 'Death Star Prototype',
    fismasubsystem: null,
  } as unknown as FismaSystemType,
]

beforeEach(() => {
  mock.reset()
})

describe('useSystemCatalog', () => {
  test('fetches both the active and decommissioned endpoints when enabled', async () => {
    mock.onGet('/fismasystems').reply(200, { data: ACTIVE })
    mock.onGet('/fismasystems?decommissioned=true').reply(200, { data: DECOMM })

    const { result } = renderHook(() => useSystemCatalog(true))

    await waitFor(() => expect(result.current.allSystems).toEqual(ACTIVE))
    expect(result.current.decommSystems).toEqual(DECOMM)
  })

  test('does not fetch either endpoint when disabled', async () => {
    mock.onGet('/fismasystems').reply(200, { data: ACTIVE })
    mock.onGet('/fismasystems?decommissioned=true').reply(200, { data: DECOMM })

    renderHook(() => useSystemCatalog(false))
    await new Promise((r) => setTimeout(r, 0))

    expect(mock.history.get).toHaveLength(0)
  })

  test('a null data payload on either endpoint resolves to an empty list, not a crash', async () => {
    mock.onGet('/fismasystems').reply(200, { data: null })
    mock.onGet('/fismasystems?decommissioned=true').reply(200, { data: null })

    const { result } = renderHook(() => useSystemCatalog(true))

    await waitFor(() => expect(result.current.allSystems).toEqual([]))
    expect(result.current.decommSystems).toEqual([])
  })

  test('the decommissioned fetch failing still lets the active list populate the picker', async () => {
    const err = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mock.onGet('/fismasystems').reply(200, { data: ACTIVE })
    mock.onGet('/fismasystems?decommissioned=true').networkError()

    const { result } = renderHook(() => useSystemCatalog(true))

    await waitFor(() => expect(result.current.allSystems).toEqual(ACTIVE))
    expect(result.current.decommSystems).toEqual([])
    err.mockRestore()
  })

  test('the active fetch failing still lets the decommissioned list populate', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    mock.onGet('/fismasystems').networkError()
    mock.onGet('/fismasystems?decommissioned=true').reply(200, { data: DECOMM })

    const { result } = renderHook(() => useSystemCatalog(true))

    await waitFor(() => expect(result.current.decommSystems).toEqual(DECOMM))
    expect(result.current.allSystems).toEqual([])
    err.mockRestore()
  })

  test('disabling (e.g. losing read access) issues no fetch on a later render, and switching back re-fetches', async () => {
    mock.onGet('/fismasystems').reply(200, { data: ACTIVE })
    mock.onGet('/fismasystems?decommissioned=true').reply(200, { data: DECOMM })

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSystemCatalog(enabled),
      { initialProps: { enabled: false } }
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(mock.history.get).toHaveLength(0)

    rerender({ enabled: true })
    await waitFor(() => expect(result.current.allSystems).toEqual(ACTIVE))
  })

  test('a re-enabled catalog load wins when the earlier load resolves last', async () => {
    type CatalogReply = (value: [number, { data: FismaSystemType[] }]) => void
    const activeResolvers: CatalogReply[] = []
    const decommResolvers: CatalogReply[] = []
    const activeSignals: AbortSignal[] = []
    const decommSignals: AbortSignal[] = []
    mock.onGet('/fismasystems').reply(
      (config) =>
        new Promise((resolve) => {
          activeResolvers.push(resolve)
          activeSignals.push(config.signal as AbortSignal)
        })
    )
    mock.onGet('/fismasystems?decommissioned=true').reply(
      (config) =>
        new Promise((resolve) => {
          decommResolvers.push(resolve)
          decommSignals.push(config.signal as AbortSignal)
        })
    )
    const newerActive = [
      { ...ACTIVE[0], fismasystemid: 11, fismaacronym: 'NEW-ACTIVE' },
    ]
    const newerDecomm = [
      { ...DECOMM[0], fismasystemid: 12, fismaacronym: 'NEW-DECOMM' },
    ]

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSystemCatalog(enabled),
      { initialProps: { enabled: true } }
    )
    await waitFor(() => expect(activeResolvers).toHaveLength(1))
    await waitFor(() => expect(decommResolvers).toHaveLength(1))

    rerender({ enabled: false })
    expect(activeSignals[0].aborted).toBe(true)
    expect(decommSignals[0].aborted).toBe(true)
    rerender({ enabled: true })
    await waitFor(() => expect(activeResolvers).toHaveLength(2))
    await waitFor(() => expect(decommResolvers).toHaveLength(2))

    activeResolvers[1]([200, { data: newerActive }])
    decommResolvers[1]([200, { data: newerDecomm }])
    await waitFor(() => expect(result.current.allSystems).toEqual(newerActive))
    expect(result.current.decommSystems).toEqual(newerDecomm)

    activeResolvers[0]([200, { data: ACTIVE }])
    decommResolvers[0]([200, { data: DECOMM }])
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.allSystems).toEqual(newerActive)
    expect(result.current.decommSystems).toEqual(newerDecomm)
  })

  test('unmounting mid-fetch aborts the requests and applies no state after', async () => {
    let resolveActive: (
      value: [number, { data: FismaSystemType[] }]
    ) => void = () => {}
    let activeSignal: AbortSignal | undefined
    let decommSignal: AbortSignal | undefined
    mock.onGet('/fismasystems').reply(
      (config) =>
        new Promise((resolve) => {
          activeSignal = config.signal as AbortSignal
          resolveActive = resolve
        })
    )
    mock.onGet('/fismasystems?decommissioned=true').reply((config) => {
      decommSignal = config.signal as AbortSignal
      return [200, { data: DECOMM }]
    })
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = renderHook(() => useSystemCatalog(true))
    await waitFor(() => expect(activeSignal).toBeDefined())
    await waitFor(() => expect(decommSignal).toBeDefined())
    expect(activeSignal?.aborted).toBe(false)
    expect(decommSignal?.aborted).toBe(false)
    unmount()
    expect(activeSignal?.aborted).toBe(true)
    expect(decommSignal?.aborted).toBe(true)
    // Resolving after unmount must not throw or warn about a state update on
    // an unmounted component; the effect's AbortController guards this.
    resolveActive([200, { data: ACTIVE }])
    await new Promise((r) => setTimeout(r, 20))
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })
})
