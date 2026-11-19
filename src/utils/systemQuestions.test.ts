import MockAdapter from 'axios-mock-adapter'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { renderHook } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import {
  fetchSystemQuestions,
  systemQuestionsQuery,
  useSystemQuestions,
  type SystemQuestionsKey,
} from './systemQuestions'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const url = apiPaths.fismaSystems.questions(1002, 5)

describe('fetchSystemQuestions', () => {
  it('pins the request to the data call', async () => {
    mock.onGet(url).reply(200, { data: [{ questionid: 900 }] })
    await expect(fetchSystemQuestions(1002, 5)).resolves.toEqual([
      { questionid: 900 },
    ])
  })

  it.each([null, []])(
    'reads %p as no questions (decommissioned system)',
    async (data) => {
      mock.onGet(url).reply(200, { data })
      await expect(fetchSystemQuestions(1002, 5)).resolves.toEqual([])
    }
  )
})

describe('systemQuestionsQuery', () => {
  it('is keyed per system and data call, under the system detail', () => {
    expect(systemQuestionsQuery(1002, 5).queryKey).toEqual(
      queryKeys.fismaSystems.questions(1002, 5)
    )
    expect(systemQuestionsQuery(1002, 5).meta).toEqual({
      suppressErrorNotification: true,
    })
  })
})

describe('useSystemQuestions', () => {
  it('reads nothing while the key is null', () => {
    const wrapper = queryWrapper(createTestQueryClient())
    const { result } = renderHook(() => useSystemQuestions(null), { wrapper })
    expect(result.current).toBeUndefined()
    expect(mock.history.get).toHaveLength(0)
  })

  it('serves an awaited fetch on the render the key moves to it', async () => {
    mock.onGet(url).reply(200, { data: [{ questionid: 900 }] })
    const client = createTestQueryClient()
    await client.fetchQuery(systemQuestionsQuery(1002, 5))
    const { result, rerender } = renderHook(
      ({ k }: { k: SystemQuestionsKey | null }) => useSystemQuestions(k),
      {
        wrapper: queryWrapper(client),
        initialProps: { k: null as SystemQuestionsKey | null },
      }
    )
    expect(result.current).toBeUndefined()
    rerender({ k: { systemId: 1002, datacallId: 5 } })
    // Synchronously, with no second request: the page relies on this to
    // commit the questions map in the same update as scores and questionId.
    expect(result.current).toEqual([{ questionid: 900 }])
    expect(mock.history.get).toHaveLength(1)
  })
})
