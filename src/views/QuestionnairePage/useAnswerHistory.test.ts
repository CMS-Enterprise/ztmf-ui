import MockAdapter from 'axios-mock-adapter'
import { apiPaths } from '@/api/keys'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  const { handleAuthError } = require('@/utils/authInterceptor')
  const instance = axios.create({ baseURL: 'api/v1/' })
  instance.interceptors.response.use(
    (response: unknown) => response,
    handleAuthError
  )
  return { __esModule: true, default: instance }
})

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), revalidate: jest.fn(), state: {} },
}))

import axiosInstance from '@/axiosConfig'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import { parseApiError } from '@/utils/apiErrors'
import { useAnswerHistory, REVISION_CONFLICT } from './useAnswerHistory'

const mock = new MockAdapter(axiosInstance)
const SCORE_ID = 4212

const HISTORY = {
  scoreid: SCORE_ID,
  fismasystemid: 1002,
  datacallid: 5,
  head: { revisionid: 91, revision_no: 2, kind: 'update', undoable: true },
  revisions: [
    {
      revisionid: 91,
      scoreid: SCORE_ID,
      revision_no: 2,
      kind: 'update',
      createdat: '2026-09-18T14:02:11Z',
      prev: {
        functionoptionid: 5,
        optionname: 'Traditional',
        score: 1,
        notes: 'original',
        notes_is_ai_summary: false,
        status: 'done',
      },
      new: {
        functionoptionid: 6,
        optionname: 'Defined',
        score: 2,
        notes: 'changed',
        notes_is_ai_summary: false,
        status: 'done',
      },
      undoable: true,
    },
  ],
}

const renderAnswerHistory = (refetchScores = jest.fn()) => {
  const queryClient = createTestQueryClient()
  const utils = renderHook(
    () => useAnswerHistory({ scoreid: SCORE_ID, refetchScores }),
    { wrapper: queryWrapper(queryClient) }
  )
  return { ...utils, refetchScores, queryClient }
}

afterEach(() => {
  mock.reset()
})

test('reads history without the drawer being opened, so the strip can offer undo', async () => {
  mock.onGet(apiPaths.scores.revisions(SCORE_ID)).reply(200, { data: HISTORY })

  const { result } = renderAnswerHistory()

  // The button that opens the drawer is itself gated on head.undoable, so a
  // read gated on `open` could never let it render.
  expect(result.current.open).toBe(false)
  await waitFor(() => expect(result.current.head).not.toBeNull())
  expect(result.current.head?.revisionid).toBe(91)
  expect(result.current.head?.undoable).toBe(true)
})

test('does not read history for an unanswered question', async () => {
  const queryClient = createTestQueryClient()
  renderHook(() => useAnswerHistory({ scoreid: 0, refetchScores: jest.fn() }), {
    wrapper: queryWrapper(queryClient),
  })

  // Nothing to have history about; a request here would 404 on every
  // unanswered question in the questionnaire.
  await new Promise((r) => setTimeout(r, 0))
  expect(mock.history.get).toHaveLength(0)
})

test('undo refetches the page scores imperatively and invalidates the history', async () => {
  mock.onGet(apiPaths.scores.revisions(SCORE_ID)).reply(200, { data: HISTORY })
  mock.onPost(apiPaths.scores.undo(SCORE_ID)).reply(200, {
    data: { score: {}, revision: {}, head: {} },
  })

  const { result, refetchScores } = renderAnswerHistory()
  await waitFor(() => expect(result.current.head).not.toBeNull())

  await act(async () => {
    await result.current.undo.mutateAsync(91)
  })

  expect(JSON.parse(mock.history.post[0].data)).toEqual({
    expected_head_revisionid: 91,
  })
  // The page's score state is useState, not query cache, so invalidation
  // alone would leave the reverted answer on screen unchanged.
  expect(refetchScores).toHaveBeenCalledTimes(1)
})

test('surfaces a stale-token conflict by code so the caller can refresh rather than retry', async () => {
  mock.onGet(apiPaths.scores.revisions(SCORE_ID)).reply(200, { data: HISTORY })
  mock.onPost(apiPaths.scores.undo(SCORE_ID)).reply(409, {
    error: 'this answer changed since you loaded it',
    code: REVISION_CONFLICT,
  })

  const { result, refetchScores } = renderAnswerHistory()
  await waitFor(() => expect(result.current.head).not.toBeNull())

  // Captured from the rejection rather than read back off undo.error: the
  // hook's error state lands on a later render, so asserting on it races the
  // flush and fails only when the suite runs alongside others.
  let rejection: unknown
  await act(async () => {
    rejection = await result.current.undo.mutateAsync(91).catch((e) => e)
  })

  // The code is carried at the envelope's top level, so parseApiError reaches
  // it without a dedicated 409 branch.
  const parsed = parseApiError(rejection)
  expect(parsed.status).toBe(409)
  expect(parsed.code).toBe(REVISION_CONFLICT)
  // A refused undo changed nothing, so the answer must not be refetched as if
  // it had.
  expect(refetchScores).not.toHaveBeenCalled()
})

test('surfaces a missing-token rejection as a field error, not a conflict', async () => {
  mock.onGet(apiPaths.scores.revisions(SCORE_ID)).reply(200, { data: HISTORY })
  mock.onPost(apiPaths.scores.undo(SCORE_ID)).reply(400, {
    error: 'invalid input',
    data: { expected_head_revisionid: 'required' },
  })

  const { result } = renderAnswerHistory()
  await waitFor(() => expect(result.current.head).not.toBeNull())

  let rejection: unknown
  await act(async () => {
    rejection = await result.current.undo.mutateAsync(91).catch((e) => e)
  })

  const parsed = parseApiError(rejection)
  expect(parsed.fieldErrors?.expected_head_revisionid).toBe('required')
  expect(parsed.code).not.toBe(REVISION_CONFLICT)
})
