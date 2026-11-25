import MockAdapter from 'axios-mock-adapter'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import type { QuestionScores } from '@/types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { queryWrapper } from '@/test-utils/queryWrapper'
import {
  type QuestionScoresKey,
  useQuestionScores,
  fetchQuestionScores,
  indexScoresByOption,
  latestEditedAt,
  questionScoresQuery,
} from './questionScores'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const row = (
  functionoptionid: number,
  last_edited_at?: string | null
): QuestionScores =>
  ({
    scoreid: functionoptionid * 10,
    functionoptionid,
    last_edited_at,
  }) as QuestionScores

const url = apiPaths.scores.list(5, 1002, true)

describe('fetchQuestionScores', () => {
  it('reads a null envelope as no answers', async () => {
    mock.onGet(url).reply(200, { data: null })
    await expect(fetchQuestionScores(5, 1002)).resolves.toEqual([])
  })
})

describe('questionScoresQuery', () => {
  it('sits under the scores prefix so score writes invalidate it', () => {
    expect(questionScoresQuery(5, 1002).queryKey).toEqual(
      queryKeys.scores.list(5, 1002, true)
    )
    expect(questionScoresQuery(5, 1002).queryKey[0]).toBe(
      queryKeys.scores.all[0]
    )
  })

  it('reads the server again on every fetch, not the cached rows', async () => {
    mock
      .onGet(url)
      .replyOnce(200, { data: [row(1)] })
      .onGet(url)
      .replyOnce(200, { data: [row(1), row(2)] })
    const client = createTestQueryClient()
    await expect(
      client.fetchQuery(questionScoresQuery(5, 1002))
    ).resolves.toHaveLength(1)
    await expect(
      client.fetchQuery(questionScoresQuery(5, 1002))
    ).resolves.toHaveLength(2)
  })
})

describe('indexScoresByOption', () => {
  it('keys rows by functionoptionid', () => {
    const map = indexScoresByOption([row(3), row(4)])
    expect(Object.keys(map)).toEqual(['3', '4'])
    expect(map[4].scoreid).toBe(40)
  })
})

describe('latestEditedAt', () => {
  it('returns the newest valid edit time', () => {
    expect(
      latestEditedAt([
        row(1, '2026-01-01T00:00:00Z'),
        row(2, '2026-03-01T00:00:00Z'),
        row(3, null),
        row(4, 'not a date'),
      ])
    ).toEqual(new Date('2026-03-01T00:00:00Z'))
  })

  it('is null when no row has an edit time', () => {
    expect(latestEditedAt([row(1), row(2, null)])).toBeNull()
  })
})

describe('useQuestionScores', () => {
  const key: QuestionScoresKey = { systemId: 1002, datacallId: 5 }

  it('serves an awaited fetch on the render the key moves, with no refetch', async () => {
    mock.onGet(url).reply(200, { data: [row(1)] })
    const client = createTestQueryClient()
    await client.fetchQuery(questionScoresQuery(5, 1002))
    const { result, rerender } = renderHook(
      ({ k }: { k: QuestionScoresKey | null }) => useQuestionScores(k),
      {
        wrapper: queryWrapper(client),
        initialProps: { k: null as QuestionScoresKey | null },
      }
    )
    expect(result.current).toBeUndefined()
    rerender({ k: key })
    expect(result.current).toHaveLength(1)
    // The shared query has zero stale time; the observer must not treat the
    // key move as a reason to read again.
    await act(async () => {})
    expect(mock.history.get).toHaveLength(1)
  })

  it('refetches when a score write invalidates the key', async () => {
    mock
      .onGet(url)
      .replyOnce(200, { data: [row(1)] })
      .onGet(url)
      .replyOnce(200, { data: [row(1), row(2)] })
    const client = createTestQueryClient()
    await client.fetchQuery(questionScoresQuery(5, 1002))
    const { result } = renderHook(() => useQuestionScores(key), {
      wrapper: queryWrapper(client),
    })
    expect(result.current).toHaveLength(1)
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.scores.all })
    })
    await waitFor(() => expect(result.current).toHaveLength(2))
  })
})
