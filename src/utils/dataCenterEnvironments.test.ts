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
  fetchDataCenterEnvironments,
  useDataCenterEnvironments,
  toDropdownOptions,
  toDropdownOptionsWithCurrent,
  toCategoryMap,
} from './dataCenterEnvironments'
import type { DataCenterEnvironment } from '@/types'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const ROWS: DataCenterEnvironment[] = [
  {
    datacenterenvironment: 'CMS-Cloud-AWS',
    category: 'CMS-Cloud-AWS',
    scoring_key: 'CMS-Cloud-AWS',
    selectable: true,
    ordr: 10,
  },
  {
    datacenterenvironment: 'data-center-gov',
    category: 'data-center-gov',
    scoring_key: 'data-center-contractor',
    selectable: true,
    ordr: 80,
  },
  {
    // legacy alias: not offered in the dropdown, but existing systems store
    // it and must still resolve to a category.
    datacenterenvironment: 'Data Center: Gov-Owned, Multi-tenant',
    category: 'data-center-gov',
    scoring_key: 'data-center-contractor',
    selectable: false,
    ordr: 0,
  },
]

describe('fetchDataCenterEnvironments', () => {
  it('unwraps the { data: [...] } envelope', async () => {
    mock.onGet('/datacenterenvironments').reply(200, { data: ROWS })
    await expect(fetchDataCenterEnvironments()).resolves.toEqual(ROWS)
  })

  it('rejects on a server error', async () => {
    mock.onGet('/datacenterenvironments').reply(500)
    await expect(fetchDataCenterEnvironments()).rejects.toBeDefined()
  })

  it('rejects on a network error', async () => {
    mock.onGet('/datacenterenvironments').networkError()
    await expect(fetchDataCenterEnvironments()).rejects.toBeDefined()
  })
})

describe('toDropdownOptions', () => {
  it('keeps only selectable rows and maps value/label, preserving order', () => {
    expect(toDropdownOptions(ROWS)).toEqual([
      { value: 'CMS-Cloud-AWS', label: 'CMS-Cloud-AWS' },
      { value: 'data-center-gov', label: 'data-center-gov' },
    ])
  })

  it('returns an empty array for no rows', () => {
    expect(toDropdownOptions([])).toEqual([])
  })
})

describe('toDropdownOptionsWithCurrent', () => {
  it('appends a non-selectable current value as a disabled option', () => {
    const options = toDropdownOptionsWithCurrent(
      ROWS,
      'Data Center: Gov-Owned, Multi-tenant'
    )
    expect(options).toEqual([
      { value: 'CMS-Cloud-AWS', label: 'CMS-Cloud-AWS' },
      { value: 'data-center-gov', label: 'data-center-gov' },
      {
        value: 'Data Center: Gov-Owned, Multi-tenant',
        label: 'Data Center: Gov-Owned, Multi-tenant',
        disabled: true,
      },
    ])
  })

  it('does not append when the current value is already selectable', () => {
    expect(toDropdownOptionsWithCurrent(ROWS, 'CMS-Cloud-AWS')).toEqual(
      toDropdownOptions(ROWS)
    )
  })

  it('does not append for a null/empty current value', () => {
    expect(toDropdownOptionsWithCurrent(ROWS, null)).toEqual(
      toDropdownOptions(ROWS)
    )
    expect(toDropdownOptionsWithCurrent(ROWS, '')).toEqual(
      toDropdownOptions(ROWS)
    )
  })
})

describe('toCategoryMap', () => {
  it('maps every raw value to its category, including non-selectable aliases', () => {
    expect(toCategoryMap(ROWS)).toEqual({
      'CMS-Cloud-AWS': 'CMS-Cloud-AWS',
      'data-center-gov': 'data-center-gov',
      'Data Center: Gov-Owned, Multi-tenant': 'data-center-gov',
    })
  })

  it('returns an empty map for no rows', () => {
    expect(toCategoryMap([])).toEqual({})
  })
})

describe('useDataCenterEnvironments', () => {
  it('returns the served rows and forwards the cancellation signal', async () => {
    mock.onGet('/datacenterenvironments').reply(200, { data: ROWS })
    const client = createTestQueryClient()

    const { result } = renderHook(() => useDataCenterEnvironments(), {
      wrapper: queryWrapper(client),
    })

    await waitFor(() => expect(result.current).toEqual(ROWS))
    expect(mock.history.get[0].signal).toBeDefined()
  })

  it('does not fetch while disabled', async () => {
    mock.onGet('/datacenterenvironments').reply(200, { data: ROWS })
    const client = createTestQueryClient()

    const { result } = renderHook(
      () => useDataCenterEnvironments({ enabled: false }),
      { wrapper: queryWrapper(client) }
    )
    await act(async () => {})

    expect(mock.history.get).toHaveLength(0)
    expect(result.current).toEqual([])
  })

  it('serves a remount from cache rather than refetching', async () => {
    mock.onGet('/datacenterenvironments').reply(200, { data: ROWS })
    const client = createTestQueryClient()

    const first = renderHook(() => useDataCenterEnvironments(), {
      wrapper: queryWrapper(client),
    })
    await waitFor(() => expect(first.result.current).toEqual(ROWS))
    first.unmount()

    const second = renderHook(() => useDataCenterEnvironments(), {
      wrapper: queryWrapper(client),
    })
    await waitFor(() => expect(second.result.current).toEqual(ROWS))

    expect(mock.history.get).toHaveLength(1)
  })
})
