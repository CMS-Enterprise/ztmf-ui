import MockAdapter from 'axios-mock-adapter'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { queryKeys } from '@/api/keys'
import { act, renderHook } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import {
  fetchFunctionOptions,
  functionOptionsQuery,
  toQuestionChoices,
  useFunctionOptions,
} from './functionOptions'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

describe('fetchFunctionOptions', () => {
  it('unwraps the envelope in server order', async () => {
    const rows = [
      { functionoptionid: 2, description: 'b', score: 2 },
      { functionoptionid: 1, description: 'a', score: 1 },
    ]
    mock.onGet('/functions/7006/options').reply(200, { data: rows })
    await expect(fetchFunctionOptions(7006)).resolves.toEqual(rows)
  })

  it('reads a null envelope as no options', async () => {
    mock.onGet('/functions/7006/options').reply(200, { data: null })
    await expect(fetchFunctionOptions(7006)).resolves.toEqual([])
  })
})

describe('functionOptionsQuery', () => {
  it('uses the shared key and keeps failures out of the toast', () => {
    const opts = functionOptionsQuery(7006)
    expect(opts.queryKey).toEqual(queryKeys.functionOptions(7006))
    expect(opts.meta).toEqual({ suppressErrorNotification: true })
  })
})

describe('toQuestionChoices', () => {
  it('maps rows to radio choices without pre-checking any', () => {
    expect(
      toQuestionChoices([
        { functionoptionid: 2, description: 'b', score: 3 } as never,
      ])
    ).toEqual([{ label: 'b', value: 2, score: 3 }])
  })
})

describe('useFunctionOptions', () => {
  it('serves an awaited fetch when the id moves, with no second read', async () => {
    mock.onGet('/functions/7006/options').reply(200, {
      data: [{ functionoptionid: 1, description: 'a', score: 1 }],
    })
    const client = createTestQueryClient()
    // The page's tests give this key zero stale time to keep their run-once
    // guards honest; the observer must still not read again on the move.
    client.setQueryDefaults(['functions'], { staleTime: 0 })
    await client.fetchQuery(functionOptionsQuery(7006))
    const { result, rerender } = renderHook(
      ({ id }: { id: number | null }) => useFunctionOptions(id),
      {
        wrapper: queryWrapper(client),
        initialProps: { id: null as number | null },
      }
    )
    expect(result.current).toBeUndefined()
    rerender({ id: 7006 })
    expect(result.current).toEqual([{ label: 'a', value: 1, score: 1 }])
    await act(async () => {})
    expect(mock.history.get).toHaveLength(1)
  })
})
