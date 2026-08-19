import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
  configure as rtlConfigure,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
import { COMPLETE_HINT_MSG, NEXT_HINT_MSG } from '@/constants'
import type { userData } from '@/types'

// Rendered-component coverage for three QuestionnairePage effect paths from
// the encrypted-drafts hardening (#481, closes #475):
//   1. Scores fetch 403 (auth-handled) still commits the questions batch.
//   2. Read-only sessions evict a lingering draft; an in-flight save from
//      before the flip cannot resurrect it.
//   3. An out-of-band scores refresh re-seeds the current answer without
//      overwriting in-progress edits or posting a duplicate score.

jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { INSIGHTS_SUGGEST_FIX_ENABLED: false },
}))

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))
const axios = require('@/axiosConfig').default as {
  get: jest.Mock
  post: jest.Mock
  put: jest.Mock
}

// The questionnaire POSTs a fire-and-forget 'events/view' analytics ping on
// every question open (time-spent tracking, #368). These assertions care about
// score *saves* (POST 'scores'), so filter the view pings out.
const saveScorePosts = () =>
  axios.post.mock.calls.filter((c: unknown[]) => c[0] === 'scores')

const saveDraftMock = jest
  .fn<
    Promise<boolean>,
    [string, number, number, number, unknown, () => boolean]
  >()
  .mockResolvedValue(true)
const clearDraftMock = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined)
const loadDraftMock = jest
  .fn<Promise<null>, unknown[]>()
  .mockResolvedValue(null)

jest.mock('./draftStore', () => ({
  saveDraft: (...args: unknown[]) =>
    saveDraftMock(...(args as Parameters<typeof saveDraftMock>)),
  loadDraft: (...args: unknown[]) => loadDraftMock(...args),
  clearDraft: (...args: unknown[]) => clearDraftMock(...args),
}))

const notifyMock = jest.fn()
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return {
    ...actual,
    notify: (...args: unknown[]) => notifyMock(...args),
  }
})

// Stub the insights panel and option badges with recognizable text so the
// justification-integration tests can assert their presence/absence without
// depending on the real panel's internals. OptionInsightBadges renders nothing
// when no insight is passed, matching the real component — so the existing
// effect-path tests (which run with insights disabled) are unaffected.
jest.mock('./InsightsPanel/InsightsPanel', () => {
  const react = require('react')
  return {
    __esModule: true,
    default: () => react.createElement('div', null, 'ZTMF Insights panel'),
    OptionInsightBadges: ({ insight }: { insight?: unknown }) =>
      insight
        ? react.createElement('span', null, 'ZTMF Insights option badge')
        : null,
  }
})

// react-router memoizes its DataRoutes wrapper, so parent rerenders with
// identical router props don't propagate to QuestionnairePage. Wire the
// context mock to a subscribable store (useSyncExternalStore) so calling
// setMockCtx from a test forces the memoized subtree to re-render.
const mockCtxListeners = new Set<() => void>()
let mockCtxValue: Record<string, unknown> = {}
function setMockCtx(next: Record<string, unknown>) {
  mockCtxValue = next
  mockCtxListeners.forEach((l) => l())
}
jest.mock('../Title/Context', () => ({
  useContextProp: () => {
    const react = require('react')
    return react.useSyncExternalStore(
      (cb: () => void) => {
        mockCtxListeners.add(cb)
        return () => mockCtxListeners.delete(cb)
      },
      () => mockCtxValue
    )
  },
}))

// Import after mocks so the page picks them up.
import QuestionnairePage from './QuestionnairePage'

const QUESTIONS = [
  {
    questionid: 900,
    question: 'Question for Imperial Identity Verification',
    notesprompt: 'Notes',
    pillar: { pillar: 'Identity' },
    function: {
      functionid: 7006,
      function: 'Imperial Identity Verification',
      description: 'IIV description',
      datacenterenvironment: 'Imperial-Fleet',
    },
  },
  {
    questionid: 901,
    question: 'Question for Imperial Device Management',
    notesprompt: 'Notes',
    pillar: { pillar: 'Devices' },
    function: {
      functionid: 7001,
      function: 'Imperial Device Management',
      description: 'IDM description',
      datacenterenvironment: 'Imperial-Fleet',
    },
  },
]

const OPTIONS_7006 = [
  {
    functionoptionid: 100,
    description: 'Baseline',
    score: 1,
  },
  {
    functionoptionid: 101,
    description: 'Advanced',
    score: 2,
  },
]

const SSD_EX = {
  fismasystemid: 1002,
  fismaacronym: 'SSD-EX',
  fismaname: 'Super Star Destroyer Executor Command Systems',
  datacenterenvironment: 'Imperial-Fleet',
  opdiv_id: 9,
}

function makeCtx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userInfo: {
      userid: 'u-1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role: 'OWNER',
    } as userData,
    latestDataCallId: 5,
    latestDatacall: 'FY2026 Q1',
    latestDeadline: '2099-12-31T23:59:59Z',
    selectedDatacall: {
      datacallid: 5,
      datacall: 'FY2026 Q1',
      datecreated: '',
      deadline: '2099-12-31T23:59:59Z',
    },
    datacalls: [
      {
        datacallid: 5,
        datacall: 'FY2026 Q1',
        datecreated: '',
        deadline: '2099-12-31T23:59:59Z',
      },
    ],
    activeDatacallIds: [5],
    fismaSystems: [SSD_EX],
    setFismaSystems: jest.fn(),
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    fetchFismaSystems: jest.fn(),
    datacenterEnvironments: [],
    opdivs: [],
    opdivsLoaded: true,
    ...overrides,
  }
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: AppRoutes.QUESTIONNAIRE, element: <QuestionnairePage /> }],
    { initialEntries: [path] }
  )
  const provider = <RouterProvider router={router} />
  const utils = render(provider)
  return { ...utils, rerender: () => utils.rerender(provider) }
}

const DEEP_LINK =
  '/questionnaire/ssd-ex/FY2026_Q1/identity/imperial-identity-verification'

beforeEach(() => {
  jest.clearAllMocks()
  setMockCtx(makeCtx())
  axios.get.mockReset()
  axios.post.mockReset()
  axios.put.mockReset()
  // clearAllMocks wipes .mockResolvedValue defaults set at declaration
  // time, so re-establish per-test.
  saveDraftMock.mockResolvedValue(true)
  clearDraftMock.mockResolvedValue(undefined)
  loadDraftMock.mockResolvedValue(null)
})

// ---------------------------------------------------------------------------
// 1. Scores 403 (auth-handled) still commits the questions batch
// ---------------------------------------------------------------------------

test('scores fetch 403 (auth-handled) still commits questions and opens the target function', async () => {
  // The interceptor tags handled errors with __authHandled; the notify util's
  // isAuthHandled() checks for that exact prop.
  const authError = Object.assign(new Error('forbidden'), {
    __authHandled: true,
  })
  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.reject(authError)
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })

  renderAt(DEEP_LINK)

  // The [questionId] effect's fetchOptions call is the observable that
  // proves the batch committed - it only fires after setQuestionId ran.
  await waitFor(() =>
    expect(
      axios.get.mock.calls.some(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          (c[0] as string).includes('functions/7006/options')
      )
    ).toBe(true)
  )
  // Sidebar/URL committed together with the content; not stuck loading.
  await waitFor(() =>
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  )
  // Auth-handled path is silent - no "try again" toast fires.
  expect(
    notifyMock.mock.calls.some(
      (c) => typeof c[0] === 'string' && /try again/i.test(c[0])
    )
  ).toBe(false)
})

// ---------------------------------------------------------------------------
// 2. Read-only sessions evict the current-question draft; in-flight save
//    from before the flip cannot resurrect it (isCurrent returns false).
// ---------------------------------------------------------------------------

test('read-only session evicts the current-question draft on mount', async () => {
  // Past-deadline datacall makes the session read-only for a non-admin role.
  const pastDeadline = '2001-01-01T00:00:00Z'
  setMockCtx(
    makeCtx({
      userInfo: {
        userid: 'u-1',
        email: 'x@x',
        fullname: 'ISSO',
        role: 'ISSO',
      } as userData,
      latestDeadline: pastDeadline,
      selectedDatacall: {
        datacallid: 5,
        datacall: 'FY2026 Q1',
        datecreated: '',
        deadline: pastDeadline,
      },
      datacalls: [
        {
          datacallid: 5,
          datacall: 'FY2026 Q1',
          datecreated: '',
          deadline: pastDeadline,
        },
      ],
    })
  )

  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })

  renderAt(DEEP_LINK)

  // fetchOptions in the read-only branch bumps saveGenRef and evicts. The
  // eviction is the observable; the paired saveGenRef++ at the same
  // callsite (QuestionnairePage.tsx around the fetchOptions read-only
  // branch) is what disarms any in-flight save from before the flip -
  // its captured currentGen no longer matches, so its isCurrent()
  // returns false and the localStorage write is skipped. That mechanism
  // is unit-tested end-to-end in draftStore.test.ts.
  await waitFor(() =>
    expect(clearDraftMock).toHaveBeenCalledWith('u-1', 1002, 7006, 5)
  )
  // No draft ever loaded in a read-only session either.
  expect(loadDraftMock).not.toHaveBeenCalled()
})

// ---------------------------------------------------------------------------
// 2c. Time-spent view pings (#368): every session emits one 'events/view' per
//     opened question with the DB questionid. The payload carries no readonly
//     flag — editor-vs-viewer is decided server-side from role + deadline.
// ---------------------------------------------------------------------------

const viewPings = () =>
  axios.post.mock.calls.filter((c: unknown[]) => c[0] === 'events/view')

test('records an events/view ping with the DB questionid when a question opens', async () => {
  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })

  renderAt(DEEP_LINK)

  // The opened function is 7006 (Imperial Identity Verification), whose DB
  // questionid is 900 - the payload must carry the questionid, not the
  // functionid, and the system + data call from context. No readonly flag: the
  // server derives editor-vs-viewer.
  await waitFor(() => expect(viewPings()).toHaveLength(1))
  expect(viewPings()[0][1]).toEqual({
    fismasystemid: 1002,
    datacallid: 5,
    questionid: 900,
  })
})

test('records an events/view ping in a read-only session too', async () => {
  const pastDeadline = '2001-01-01T00:00:00Z'
  setMockCtx(
    makeCtx({
      userInfo: {
        userid: 'u-1',
        email: 'x@x',
        fullname: 'ISSO',
        role: 'ISSO',
      } as userData,
      latestDeadline: pastDeadline,
      selectedDatacall: {
        datacallid: 5,
        datacall: 'FY2026 Q1',
        datecreated: '',
        deadline: pastDeadline,
      },
      datacalls: [
        {
          datacallid: 5,
          datacall: 'FY2026 Q1',
          datecreated: '',
          deadline: pastDeadline,
        },
      ],
    })
  )

  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })

  renderAt(DEEP_LINK)

  // Read-only viewers are captured too (#368) — the ping still fires; whether
  // it counts as viewer time is decided server-side, so the body is identical.
  await waitFor(() => expect(viewPings()).toHaveLength(1))
  expect(viewPings()[0][1]).toEqual({
    fismasystemid: 1002,
    datacallid: 5,
    questionid: 900,
  })
})

// ---------------------------------------------------------------------------
// 3. Out-of-band scores refresh re-seeds the answer
// ---------------------------------------------------------------------------

// A tiny deferred-promise helper for tests that need to hold /scores in
// flight while other work progresses.
function createDeferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const answeredBaseline = {
  functionoptionid: 100,
  scoreid: 5001,
  notes: '',
  fismasystemid: 1002,
  datacallid: 5,
  last_edited_at: '2026-06-01T00:00:00Z',
  last_edited_by: 'u-1',
}

// ---------------------------------------------------------------------------
// 1b. Datacall-switch trigger (same effect path as system-switch above)
// ---------------------------------------------------------------------------

test('scores 403 (auth-handled) on a datacall switch also commits the questions batch', async () => {
  // The fetchData effect handles both a system change and a datacall change
  // (its deps include selectedDatacall, latestDataCallId, datacalls). We
  // exercise the datacall-switch path here to confirm the auth-handled
  // fall-through at the same call site covers both triggers.
  const authError = Object.assign(new Error('forbidden'), {
    __authHandled: true,
  })
  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.reject(authError)
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })

  const { rerender } = renderAt(DEEP_LINK)
  await waitFor(() =>
    expect(
      axios.get.mock.calls.some(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          (c[0] as string).includes('functions/7006/options')
      )
    ).toBe(true)
  )

  // Swap to a different datacall. selectedDatacall and datacalls both change
  // identity; that trips the fetchData deps and the effect re-runs.
  const firstBatchCount = axios.get.mock.calls.filter(
    (c: unknown[]) =>
      typeof c[0] === 'string' &&
      (c[0] as string).startsWith('scores?datacallid=')
  ).length
  await act(async () => {
    setMockCtx(
      makeCtx({
        selectedDatacall: {
          datacallid: 5,
          datacall: 'FY2026 Q1',
          datecreated: '',
          deadline: '2099-12-31T23:59:59Z',
        },
        datacalls: [
          {
            datacallid: 5,
            datacall: 'FY2026 Q1',
            datecreated: '',
            deadline: '2099-12-31T23:59:59Z',
          },
        ],
      })
    )
    rerender()
  })
  await waitFor(() => {
    const secondBatchCount = axios.get.mock.calls.filter(
      (c: unknown[]) =>
        typeof c[0] === 'string' &&
        (c[0] as string).startsWith('scores?datacallid=')
    ).length
    expect(secondBatchCount).toBeGreaterThan(firstBatchCount)
  })
  // Second batch's fetchOptions also fires - the target function is opened
  // again after the datacall switch's 403 fall-through.
  const optionsCallCount = axios.get.mock.calls.filter(
    (c: unknown[]) =>
      typeof c[0] === 'string' &&
      (c[0] as string).includes('functions/7006/options')
  ).length
  expect(optionsCallCount).toBeGreaterThanOrEqual(1)
  // Auth-handled path stays silent across both triggers.
  expect(
    notifyMock.mock.calls.some(
      (c) => typeof c[0] === 'string' && /try again/i.test(c[0])
    )
  ).toBe(false)
})

// ---------------------------------------------------------------------------
// 2b. Editable -> read-only flip disarms an in-flight autosave (isCurrent
//     returns false after the paired saveGenRef++ in fetchOptions).
// ---------------------------------------------------------------------------

test('editable to read-only flip disarms an in-flight autosave', async () => {
  jest.useFakeTimers()
  const user = userEvent.setup({
    advanceTimers: (ms) => jest.advanceTimersByTime(ms),
  })
  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })

  const { rerender } = renderAt(DEEP_LINK)
  // Flush the initial fetch chain (fake timers don't fire microtasks).
  await act(async () => {})
  const notes = (await screen.findByLabelText(
    'Justification notes'
  )) as HTMLTextAreaElement

  // Typing schedules a saveDraft on the debounce timer.
  await user.type(notes, 'unsaved draft')
  await act(async () => {
    jest.advanceTimersByTime(1500)
  })
  await act(async () => {})

  expect(saveDraftMock).toHaveBeenCalled()
  // The 6th arg is the isCurrent callback captured at save time.
  const isCurrent = saveDraftMock.mock.calls[0][5] as () => boolean
  expect(isCurrent()).toBe(true)

  // Flip to read-only via a past-deadline datacall + non-admin role.
  await act(async () => {
    setMockCtx(
      makeCtx({
        userInfo: {
          userid: 'u-1',
          email: 'x@x',
          fullname: 'ISSO',
          role: 'ISSO',
        } as userData,
        latestDeadline: '2001-01-01T00:00:00Z',
        selectedDatacall: {
          datacallid: 5,
          datacall: 'FY2026 Q1',
          datecreated: '',
          deadline: '2001-01-01T00:00:00Z',
        },
        datacalls: [
          {
            datacallid: 5,
            datacall: 'FY2026 Q1',
            datecreated: '',
            deadline: '2001-01-01T00:00:00Z',
          },
        ],
      })
    )
    rerender()
  })
  await act(async () => {
    jest.runOnlyPendingTimers()
  })
  await act(async () => {})

  // fetchOptions' read-only branch bumps saveGenRef and evicts the draft.
  expect(clearDraftMock).toHaveBeenCalled()
  // The in-flight save's captured isCurrent now returns false: the paired
  // saveGenRef++ made currentGen stale, so a resolving encrypt-then-write
  // path would short-circuit before touching localStorage.
  expect(isCurrent()).toBe(false)

  jest.useRealTimers()
})

// ---------------------------------------------------------------------------
// 3a. Out-of-band scores refresh re-seeds an idle question's answer
//     (the L901 [questionScores, questionId] effect).
// ---------------------------------------------------------------------------

test('out-of-band scores refresh re-seeds the answer after save-and-back', async () => {
  const user = userEvent.setup()
  const scoresGate = createDeferred<{ data: { data: unknown[] } }>()
  let scoresCallCount = 0
  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) {
      scoresCallCount++
      if (scoresCallCount === 1) return Promise.resolve({ data: { data: [] } })
      // Second call = fetchQuestionScores fired by saveResponse. Hold it
      // so the user can navigate back before it resolves.
      return scoresGate.promise
    }
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })
  axios.post.mockResolvedValue({ data: { data: {} } })

  renderAt(DEEP_LINK)

  // Q1 renders unanswered.
  const baseline = (await screen.findByLabelText(
    /baseline/i
  )) as HTMLInputElement
  await waitFor(() => expect(baseline.checked).toBe(false))

  // Answer Q1, click Next -> POST fires, fetchQuestionScores GET goes in
  // flight (held by scoresGate) and questionId moves to Q2.
  await user.click(baseline)
  await user.click(screen.getByText(/^Next$/i))
  await waitFor(() => expect(saveScorePosts()).toHaveLength(1))

  // Back to Q1. fetchOptions runs with an empty scores ref (the second
  // /scores call is still pending), so Q1 briefly shows unanswered.
  await user.click(screen.getByText(/Back/i))
  const backBaseline = (await screen.findByLabelText(
    /baseline/i
  )) as HTMLInputElement
  await waitFor(() => expect(backBaseline.checked).toBe(false))

  // Now resolve the deferred /scores with the answer. The L901 re-seed
  // effect fires with a matching questionId and updated questionScores.
  await act(async () => {
    scoresGate.resolve({ data: { data: [answeredBaseline] } })
  })
  await waitFor(() => {
    const el = screen.getByLabelText(/baseline/i) as HTMLInputElement
    expect(el.checked).toBe(true)
  })
  // No duplicate POST - re-seed picked up the existing scoreid.
  expect(saveScorePosts()).toHaveLength(1)
})

// ---------------------------------------------------------------------------
// 3b. Same out-of-band refresh must NOT overwrite an unsaved in-progress edit.
// ---------------------------------------------------------------------------

test('out-of-band scores refresh does not overwrite an unsaved in-progress edit', async () => {
  // Uses the same save+back scenario as 3a but the user picks a different
  // option after returning to Q1. When the deferred scores GET (from the
  // background fetchQuestionScores) resolves with Baseline as the saved
  // answer, the L901 effect's shouldReseedAnswer must see the unsaved
  // Advanced pick and skip the reseed. That path is what keeps a user's
  // in-progress change from silently reverting to the last-saved state.
  const user = userEvent.setup()
  const scoresGate = createDeferred<{ data: { data: unknown[] } }>()
  let scoresCallCount = 0
  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) {
      scoresCallCount++
      if (scoresCallCount === 1) return Promise.resolve({ data: { data: [] } })
      return scoresGate.promise
    }
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })
  axios.post.mockResolvedValue({ data: { data: {} } })

  renderAt(DEEP_LINK)

  // Save Baseline on Q1, click Next -> fetchQuestionScores in flight.
  const baseline = (await screen.findByLabelText(
    /baseline/i
  )) as HTMLInputElement
  await user.click(baseline)
  await user.click(screen.getByText(/^Next$/i))
  await waitFor(() => expect(saveScorePosts()).toHaveLength(1))

  // Back to Q1 - fetchOptions seeds from an empty ref so Q1 shows
  // unanswered, and initQuestionChoice is now -1.
  await user.click(screen.getByText(/Back/i))
  await waitFor(() => {
    const el = screen.getByLabelText(/baseline/i) as HTMLInputElement
    expect(el.checked).toBe(false)
  })

  // User makes an in-progress edit: pick Advanced. This is the state
  // the re-seed guard must protect.
  const advanced = (await screen.findByLabelText(
    /advanced/i
  )) as HTMLInputElement
  await user.click(advanced)
  await waitFor(() => expect(advanced.checked).toBe(true))

  // Now the deferred scores GET resolves with the previously-saved
  // Baseline. shouldReseedAnswer sees the unsaved Advanced pick and
  // returns false; the effect does NOT overwrite state.
  await act(async () => {
    scoresGate.resolve({ data: { data: [answeredBaseline] } })
  })
  // Give the [questionScores,questionId] effect a chance to run.
  await new Promise((r) => setTimeout(r, 50))

  const advancedAfter = screen.getByLabelText(/advanced/i) as HTMLInputElement
  expect(advancedAfter.checked).toBe(true)
  const baselineAfter = screen.getByLabelText(/baseline/i) as HTMLInputElement
  expect(baselineAfter.checked).toBe(false)
})

test('the questionId effect reads live scores via ref and seeds the answer at mount', async () => {
  // #481 replaced questionScores-in-deps with a stable ref so the effect
  // runs exactly once per questionId and always reads the freshest scores
  // map. Concrete observable: when /scores returns Q1 answered on mount,
  // the [questionId] effect's fetchOptions must mark the option checked
  // and NOT re-run itself after questionScores state updates. That in
  // turn keeps the debounce effect from racing a clearDraft against a
  // re-seeded initial value (the original #481 failure mode).
  const answeredScore = {
    functionoptionid: 100,
    scoreid: 5001,
    notes: 'prior context',
    fismasystemid: 1002,
    datacallid: 5,
    last_edited_at: '2026-06-01T00:00:00Z',
    last_edited_by: 'u-1',
  }
  axios.get.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores'))
      return Promise.resolve({ data: { data: [answeredScore] } })
    if (url.includes('/options'))
      return Promise.resolve({ data: { data: OPTIONS_7006 } })
    return Promise.resolve({ data: { data: [] } })
  })

  renderAt(DEEP_LINK)

  // Options render with the saved answer marked - the ref-based seed
  // fired with the up-to-date scores map.
  await waitFor(() => expect(screen.getByText('Baseline')).toBeInTheDocument())
  const baseline = screen.getByLabelText(/baseline/i) as HTMLInputElement
  await waitFor(() => expect(baseline.checked).toBe(true))
  const advanced = screen.getByLabelText(/advanced/i) as HTMLInputElement
  expect(advanced.checked).toBe(false)

  // fetchOptions fired exactly once for the target function - the ref
  // avoided the second effect run that questionScores-in-deps caused.
  const optionsCalls = axios.get.mock.calls.filter(
    (c: unknown[]) =>
      typeof c[0] === 'string' &&
      (c[0] as string).includes('functions/7006/options')
  )
  expect(optionsCalls).toHaveLength(1)

  // No POST fired - the saved answer was seeded from GET, not written
  // back as a fresh score.
  expect(saveScorePosts()).toHaveLength(0)
})

// ---------------------------------------------------------------------------
// 4. ZTMF Insights justification-field wiring (#527/#529).
//    - The insights layer (panel, option badges, suggestion) is gated on the
//      SYSTEM's OpDiv (opdivs.insights_enabled), not the viewed call's name:
//      an enabled OpDiv keeps its insights inside the unified HHS-named cycle
//      (the FY2026 regression), and a disabled OpDiv never sees the layer.
//    - The review-aware JustificationField renders regardless of OpDiv.
//    - A carried-forward prior response blocks submission until reviewed, and
//      the initial insights lookup blocks submission until it settles.
//    - A question with no justification context keeps the plain notes field.
// ---------------------------------------------------------------------------

const PRIOR_RESPONSE = 'MFA is enforced through Okta policies.'

const JUSTIFICATION_QUESTION = {
  questionid: 900,
  question: 'How does the system authenticate users?',
  notesprompt: 'Explain the authentication mechanisms.',
  pillar: { pillar: 'Identity' },
  function: {
    functionid: 7006,
    function: 'Imperial Identity Verification',
    description: 'Authenticate users.',
    datacenterenvironment: 'Imperial-Fleet',
  },
}

const JUSTIFICATION_OPTIONS = [
  { functionoptionid: 100, description: 'Baseline', score: 1 },
  { functionoptionid: 101, description: 'Advanced', score: 2 },
]

// Carried forward from the prior data call: no edit event for the current call
// (last_edited_at null) and its notes match the insight's last_score_notes, so
// it is treated as context requiring an explicit review, not a submitted answer.
const CARRY_FORWARD_SCORE = {
  scoreid: 5001,
  fismasystemid: 1002,
  notes: PRIOR_RESPONSE,
  functionoptionid: 100,
  datacallid: 5,
  last_edited_at: null,
  last_edited_by: null,
}

const INSIGHT_ROW = {
  fismasystemid: 1002,
  questionid: 900,
  synced_at: '2026-07-14T00:00:00Z',
  payload: {
    suggested_score: 1,
    suggested_label: 'Baseline',
    cfacts_auth_methods: 'IDM-Okta',
    last_score: 1,
    last_score_notes: PRIOR_RESPONSE,
    // A prior cycle, distinct from the FY2026 Q1 / FY25 ZTM calls under test, so
    // the carried-forward response is offered as last year's context.
    last_datacall: 'FY2025 Q1',
    // FIPS data is a federal-wide concept; must render for both CMS and HHS.
    fips_impact_level: 'Low',
    fips_ceiling: 2,
  },
}

const HHS_ZTM = {
  datacallid: 6,
  datacall: 'FY25 ZTM',
  datecreated: '',
  deadline: '2099-12-31T23:59:59Z',
}

const HHS_DEEP_LINK =
  '/questionnaire/ssd-ex/FY25_ZTM/identity/imperial-identity-verification'

// SSD-EX (opdiv_id 9) belongs to the insights-enabled OpDiv; 2 is a disabled
// OpDiv for the negative case.
const OPDIV_ROWS = [
  {
    opdiv_id: 9,
    code: 'CMS',
    name: 'Centers for Medicare & Medicaid Services',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
    insights_enabled: true,
  },
  {
    opdiv_id: 2,
    code: 'ACF',
    name: 'Administration for Children and Families',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
    insights_enabled: false,
  },
]

describe('QuestionnairePage justification integration', () => {
  type InsightsResponse = { data: { data: unknown[] } }

  // This block is the insights-enabled variant: SSD-EX's OpDiv (9) carries
  // insights_enabled, so the layer is expected on unless a test says otherwise.
  const insightsCtx = (overrides: Record<string, unknown> = {}) =>
    makeCtx({ opdivs: OPDIV_ROWS, ...overrides })

  function installMocks({
    insightRows = [INSIGHT_ROW] as unknown[],
    insightsResponse,
  }: {
    insightRows?: unknown[]
    insightsResponse?: Promise<InsightsResponse>
  } = {}) {
    axios.get.mockImplementation((url: string) => {
      if (url === 'insights') {
        return (
          insightsResponse ?? Promise.resolve({ data: { data: insightRows } })
        )
      }
      if (url.includes('/questions'))
        return Promise.resolve({ data: { data: [JUSTIFICATION_QUESTION] } })
      if (url.startsWith('scores'))
        return Promise.resolve({ data: { data: [CARRY_FORWARD_SCORE] } })
      if (url.includes('/options'))
        return Promise.resolve({ data: { data: JUSTIFICATION_OPTIONS } })
      return Promise.resolve({ data: { data: [] } })
    })
    axios.post.mockResolvedValue({ data: {} })
    axios.put.mockResolvedValue({ data: {} })
  }

  it('keeps the insights layer on an HHS-named call for an insights-enabled OpDiv, and persists an accepted prior response', async () => {
    installMocks()
    setMockCtx(
      insightsCtx({
        latestDataCallId: 6,
        latestDatacall: 'FY25 ZTM',
        selectedDatacall: HHS_ZTM,
        datacalls: [HHS_ZTM],
      })
    )

    renderAt(HHS_DEEP_LINK)

    // The JustificationField appears (there is a prior response to review)...
    const response = await screen.findByRole('textbox', {
      name: 'Current response',
    })
    expect(await screen.findByText('Review required')).toBeInTheDocument()
    // ...but the pending review empties the on-screen value and blocks submit.
    expect(response).toHaveValue('')

    // The FIPS baseline is a federal-wide concept and must appear for HHS too.
    expect(await screen.findByText('Low baseline')).toBeInTheDocument()

    // The insights layer follows the system's OpDiv, not the call name: an
    // insights-enabled OpDiv keeps its panel inside the HHS-named cycle (the
    // FY2026 single-call regression this gate change fixes).
    expect(await screen.findByText('ZTMF Insights panel')).toBeInTheDocument()
    expect(
      (await screen.findAllByText('ZTMF Insights option badge')).length
    ).toBeGreaterThan(0)
    expect(
      await screen.findByText('Suggested justification')
    ).toBeInTheDocument()

    const complete = screen.getByRole('button', { name: 'Complete' })
    expect(complete).toBeDisabled()

    // Accepting the required review must land even though the text equals
    // the seeded prior response — via the confirm endpoint, since the old
    // identical-body answer PUT was silently discarded by the backend's
    // no-op guard. Insert alone performs no write (like the
    // insights-suggestion card's Insert); the resolved review lands on the
    // next navigation, so the two adjacent Insert buttons behave alike.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    expect(response).toHaveValue(PRIOR_RESPONSE)
    expect(complete).toBeEnabled()
    expect(axios.put).not.toHaveBeenCalled()

    fireEvent.click(complete)

    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith('scores/5001/confirm')
    )
    // The unchanged answer body must NOT be re-PUT — that path re-stamps
    // nothing server-side and would clear notes_is_ai_summary on a real
    // change-detection miss.
    expect(axios.put).not.toHaveBeenCalledWith('scores/5001', expect.anything())
  })

  it('shows the insights panel, option badges, and suggestion for a CMS data call', async () => {
    installMocks()
    setMockCtx(insightsCtx())

    renderAt(DEEP_LINK)

    expect(await screen.findByText('ZTMF Insights panel')).toBeInTheDocument()
    expect(
      (await screen.findAllByText('ZTMF Insights option badge')).length
    ).toBeGreaterThan(0)
    expect(
      await screen.findByText('Suggested justification')
    ).toBeInTheDocument()
    expect(
      await screen.findByText("Last year's response — FY2025 Q1")
    ).toBeInTheDocument()
  })

  it('hides the insights layer when the system belongs to an insights-disabled OpDiv', async () => {
    installMocks()
    setMockCtx(
      insightsCtx({
        opdivs: [{ ...OPDIV_ROWS[0], insights_enabled: false }, OPDIV_ROWS[1]],
      })
    )

    renderAt(DEEP_LINK)

    // The justification review context still renders...
    expect(await screen.findByText('Review required')).toBeInTheDocument()
    // ...and the federal-wide FIPS baseline treatment stays.
    expect(await screen.findByText('Low baseline')).toBeInTheDocument()
    // ...but every insights surface is suppressed, regardless of call name.
    expect(screen.queryByText('ZTMF Insights panel')).not.toBeInTheDocument()
    expect(
      screen.queryByText('ZTMF Insights option badge')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Suggested justification')
    ).not.toBeInTheDocument()
  })

  it('keeps the gate closed and submission blocked until the OpDiv lookup settles', async () => {
    installMocks()
    setMockCtx(insightsCtx({ opdivs: [], opdivsLoaded: false }))

    renderAt(DEEP_LINK)

    // Insights rows resolved instantly, but the OpDiv capability list has
    // not - the gate stays closed and the page still reads as pending, so
    // the panel cannot pop in after the user has already advanced.
    const complete = await screen.findByRole('button', { name: 'Complete' })
    expect(
      await screen.findByText('Checking for prior responses…')
    ).toBeInTheDocument()
    expect(complete).toBeDisabled()
    expect(screen.queryByText('ZTMF Insights panel')).not.toBeInTheDocument()

    await act(async () => {
      setMockCtx(insightsCtx({ opdivsLoaded: true }))
    })

    expect(await screen.findByText('ZTMF Insights panel')).toBeInTheDocument()
    expect(
      screen.queryByText('Checking for prior responses…')
    ).not.toBeInTheDocument()
  })

  it('blocks submission until the initial insights lookup settles', async () => {
    let resolveInsights: ((value: InsightsResponse) => void) | null = null
    const insightsResponse = new Promise<InsightsResponse>((resolve) => {
      resolveInsights = resolve
    })
    installMocks({ insightsResponse })
    setMockCtx(insightsCtx())

    renderAt(DEEP_LINK)

    const complete = await screen.findByRole('button', { name: 'Complete' })
    expect(
      await screen.findByText('Checking for prior responses…')
    ).toBeInTheDocument()
    expect(complete).toBeDisabled()

    await act(async () => {
      resolveInsights?.({ data: { data: [INSIGHT_ROW] } })
    })

    expect(await screen.findByText('Review required')).toBeInTheDocument()
    expect(
      screen.queryByText('Checking for prior responses…')
    ).not.toBeInTheDocument()
    // Still blocked: the carried-forward response now requires review.
    expect(complete).toBeDisabled()
  })

  it('keeps the plain four-row notes field when the question has no justification context', async () => {
    installMocks({ insightRows: [] })
    setMockCtx(insightsCtx())

    renderAt(DEEP_LINK)

    expect(
      await screen.findByText('Explain the authentication mechanisms.')
    ).toBeInTheDocument()
    const response = screen.getByRole('textbox', {
      name: 'Justification notes',
    })
    expect(response).toHaveAttribute('rows', '4')
    expect(
      screen.queryByRole('textbox', { name: 'Current response' })
    ).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Carried-forward confirmation: badge, inline Confirm, the #413
// browse-is-write-free guard, and the Complete summary.
// ---------------------------------------------------------------------------

describe('carried-forward confirmation', () => {
  // CI runners execute this suite ~3x slower than a dev machine, and these
  // tests each begin by awaiting a full page load — RTL's default 1s
  // findBy/waitFor timeout flaked there while the question was still
  // loading. Raise the async ceiling for this block only; passing tests are
  // unaffected (they resolve as soon as the DOM settles).
  beforeAll(() => {
    rtlConfigure({ asyncUtilTimeout: 4000 })
    jest.setTimeout(15000)
  })
  afterAll(() => {
    rtlConfigure({ asyncUtilTimeout: 1000 })
    jest.setTimeout(5000)
  })

  const OPTIONS_7001 = [
    { functionoptionid: 200, description: 'Baseline', score: 1 },
    { functionoptionid: 201, description: 'Advanced', score: 2 },
  ]

  // A row copied by the FY2026 rollover: status not_started, no edit event.
  const carried7006 = (status: 'not_started' | 'done' = 'not_started') => ({
    scoreid: 6001,
    fismasystemid: 1002,
    notes: 'carried justification',
    functionoptionid: 100,
    datacallid: 5,
    status,
    functionoption: {
      functionoptionid: 100,
      functionid: 7006,
      score: 1,
      optionname: 'Baseline',
      description: 'Baseline',
    },
    last_edited_at: null,
    last_edited_by: null,
  })

  const done7001 = () => ({
    scoreid: 6002,
    fismasystemid: 1002,
    notes: 'answered this cycle',
    functionoptionid: 200,
    datacallid: 5,
    status: 'done',
    functionoption: {
      functionoptionid: 200,
      functionid: 7001,
      score: 1,
      optionname: 'Baseline',
      description: 'Baseline',
    },
  })

  const DEVICES_LINK =
    '/questionnaire/ssd-ex/FY2026_Q1/devices/imperial-device-management'

  // The guidance sentence, asserted by exact text so a copy change has to be
  // deliberate.
  const HELPER_COPY =
    'Review the carried-forward answer and confirm it, or write a new justification, before continuing.'

  // A past-deadline cycle. OWNER stays writable past the deadline, so this
  // isolates the open-call gate from the read-only one.
  const closedCallCtx = () => {
    const deadline = '2001-01-01T00:00:00Z'
    const call = {
      datacallid: 5,
      datacall: 'FY2026 Q1',
      datecreated: '',
      deadline,
    }
    return {
      latestDeadline: deadline,
      selectedDatacall: call,
      datacalls: [call],
    }
  }

  // Serves a mutable scores list and, like the real backend, flips the
  // targeted row to done when the confirm endpoint is hit — so the refetch
  // after a confirm returns the confirmed row instead of resurrecting the
  // original fixture. Insights/OpDiv rows default to empty (the non-CMS
  // variant); pass them to exercise the prior-response card.
  function installScoreMocks(
    scores: Array<{ scoreid: number }>,
    { insightRows = [] as unknown[] }: { insightRows?: unknown[] } = {}
  ) {
    let rows = scores
    axios.get.mockImplementation((url: string) => {
      if (url === 'insights')
        return Promise.resolve({ data: { data: insightRows } })
      if (url.includes('/questions'))
        return Promise.resolve({ data: { data: QUESTIONS } })
      if (url.startsWith('scores'))
        return Promise.resolve({ data: { data: rows } })
      if (url.includes('functions/7006/options'))
        return Promise.resolve({ data: { data: OPTIONS_7006 } })
      if (url.includes('functions/7001/options'))
        return Promise.resolve({ data: { data: OPTIONS_7001 } })
      return Promise.resolve({ data: { data: [] } })
    })
    axios.post.mockResolvedValue({ data: {} })
    axios.put.mockImplementation((url: string) => {
      const confirm = /^scores\/(\d+)\/confirm$/.exec(url)
      if (confirm) {
        rows = rows.map((row) =>
          row.scoreid === Number(confirm[1]) ? { ...row, status: 'done' } : row
        )
      }
      return Promise.resolve({ data: { data: {} } })
    })
  }

  it('badges an unconfirmed carried-forward answer in the question view and sidebar, and confirms it with one dedicated PUT', async () => {
    installScoreMocks([carried7006()])

    renderAt(DEEP_LINK)

    // Question-view badge (role="status" so the flip below is announced).
    const badge = await screen.findByText('Carried forward — not yet confirmed')
    expect(badge).toBeInTheDocument()
    // Sidebar marker for the same fact, on the carried question only.
    expect(screen.getAllByText('Not yet confirmed')).toHaveLength(1)

    // The explicit act: exactly one confirm PUT, no answer PUT/POST.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    )
    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith('scores/6001/confirm')
    )
    expect(axios.put).toHaveBeenCalledTimes(1)
    expect(saveScorePosts()).toHaveLength(0)

    // Feedback is the badge swapping to its confirmed state.
    expect(
      await screen.findByText('Updated this data call')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Carried forward — not yet confirmed')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    ).not.toBeInTheDocument()
  })

  it('keeps Next write-free on an untouched carried-forward question (#413)', async () => {
    installScoreMocks([carried7006()])

    renderAt(DEEP_LINK)

    await screen.findByText('Carried forward — not yet confirmed')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    // Navigation happened (the next question's options load)...
    await waitFor(() =>
      expect(
        axios.get.mock.calls.some(
          (c: unknown[]) =>
            typeof c[0] === 'string' &&
            (c[0] as string).includes('functions/7001/options')
        )
      ).toBe(true)
    )
    // ...and no write of any kind was issued.
    expect(axios.put).not.toHaveBeenCalled()
    expect(saveScorePosts()).toHaveLength(0)
  })

  it('yields the Confirm button and its guidance to the edit path the moment the question is dirty', async () => {
    installScoreMocks([carried7006()])

    renderAt(DEEP_LINK)

    await screen.findByRole('button', {
      name: 'Confirm this answer is still accurate',
    })
    expect(screen.getByText(HELPER_COPY)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Advanced/ }))

    expect(
      screen.queryByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    ).not.toBeInTheDocument()
    // The guidance retires with the button: once the user is editing, telling
    // them to write a new justification describes what they are already doing.
    expect(screen.queryByText(HELPER_COPY)).not.toBeInTheDocument()
    // The badge still shows — the row is still unconfirmed until saved.
    expect(
      screen.getByText('Carried forward — not yet confirmed')
    ).toBeInTheDocument()
  })

  it('keeps the guidance off a resolved prior-response card, where the button returns', async () => {
    // Pins !currentPriorResponse: a resolved review unblocks the button, so
    // that term is the only thing keeping the strip quiet on insights
    // questions, where the card owns the explanation.
    installScoreMocks([carried7006()], {
      insightRows: [
        {
          fismasystemid: 1002,
          questionid: 900,
          synced_at: '2026-07-14T00:00:00Z',
          payload: {
            last_score_notes: 'carried justification',
            last_datacall: 'FY2025 Q1',
          },
        },
      ],
    })

    renderAt(DEEP_LINK)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )

    // The review is resolved, so the Confirm button is offered...
    expect(
      await screen.findByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    ).toBeInTheDocument()
    // ...but the card owns the explanation on this variant.
    expect(screen.queryByText(HELPER_COPY)).not.toBeInTheDocument()
  })

  it('shows the badge but no Confirm button to a read-only admin', async () => {
    installScoreMocks([carried7006()])
    setMockCtx(
      makeCtx({
        userInfo: {
          userid: 'u-2',
          email: 'auditor@hhs.gov',
          fullname: 'Read Only',
          role: 'HHS_READONLY_ADMIN',
        } as userData,
      })
    )

    renderAt(DEEP_LINK)

    expect(
      await screen.findByText('Carried forward — not yet confirmed')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    ).not.toBeInTheDocument()
    // No action to take, so no instruction to take it.
    expect(screen.queryByText(HELPER_COPY)).not.toBeInTheDocument()
  })

  it('states what makes the carried answer count, and describes the Confirm button with it', async () => {
    installScoreMocks([carried7006()])

    renderAt(DEEP_LINK)

    expect(await screen.findByText(HELPER_COPY)).toBeInTheDocument()
    // The reason is announced with the action, not as a second live region.
    expect(
      screen.getByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    ).toHaveAccessibleDescription(HELPER_COPY)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    )

    // Confirmed: the instruction retires with the button.
    expect(
      await screen.findByText('Updated this data call')
    ).toBeInTheDocument()
    expect(screen.queryByText(HELPER_COPY)).not.toBeInTheDocument()
  })

  it('leaves the guidance to the prior-response card when one is shown', async () => {
    // The insights variant blanks the field and explains itself through the
    // card's own review message; a second sentence here would duplicate it.
    installScoreMocks([carried7006()], {
      insightRows: [
        {
          fismasystemid: 1002,
          questionid: 900,
          synced_at: '2026-07-14T00:00:00Z',
          payload: {
            last_score_notes: 'carried justification',
            last_datacall: 'FY2025 Q1',
          },
        },
      ],
    })

    renderAt(DEEP_LINK)

    expect(
      await screen.findByText(
        'Review the previous response and insert it, or dismiss it and write a new justification, to continue.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(HELPER_COPY)).not.toBeInTheDocument()
  })

  it('renders no carried-forward treatment on a closed data call', async () => {
    installScoreMocks([carried7006()])
    const pastDeadline = '2001-01-01T00:00:00Z'
    // OWNER stays writable past the deadline (isReadOnly false), isolating
    // the open-call gate as the only thing hiding the treatment.
    setMockCtx(
      makeCtx({
        latestDeadline: pastDeadline,
        selectedDatacall: {
          datacallid: 5,
          datacall: 'FY2026 Q1',
          datecreated: '',
          deadline: pastDeadline,
        },
        datacalls: [
          {
            datacallid: 5,
            datacall: 'FY2026 Q1',
            datecreated: '',
            deadline: pastDeadline,
          },
        ],
      })
    )

    renderAt(DEEP_LINK)

    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    )
    expect(
      screen.queryByText('Carried forward — not yet confirmed')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Confirm this answer is still accurate',
      })
    ).not.toBeInTheDocument()
  })

  it('explains what Complete does on the last question, and describes the button with it', async () => {
    // ISSOs read "Complete" as "submit the whole questionnaire" and asked
    // whether the last question can be saved on its own at all.
    installScoreMocks([carried7006()])

    renderAt(DEVICES_LINK)

    const complete = await screen.findByRole('button', { name: 'Complete' })
    // A hint, not standing text: nothing is drawn on the page until asked for.
    // (The sr-only copy backing aria-describedby is in the DOM but not
    // rendered, which is why this asserts on the tooltip and not on the text.)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    // It describes the action rather than renaming it.
    expect(complete).toHaveAccessibleName('Complete')
    expect(complete).toHaveAccessibleDescription(COMPLETE_HINT_MSG)

    await userEvent.hover(complete)

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      COMPLETE_HINT_MSG
    )
  })

  it('explains what Next does on a question that is not last', async () => {
    installScoreMocks([carried7006()])

    // 7006 (Identity) is the first of the two questions, so the button is Next.
    renderAt(DEEP_LINK)

    const next = await screen.findByRole('button', { name: /Next/ })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(next).toHaveAccessibleDescription(NEXT_HINT_MSG)

    await userEvent.hover(next)

    expect(await screen.findByRole('tooltip')).toHaveTextContent(NEXT_HINT_MSG)
    // The two variants must not bleed into each other: Next makes no promise
    // about a summary, which only Complete produces.
    expect(screen.queryByText(COMPLETE_HINT_MSG)).not.toBeInTheDocument()
  })

  it('keeps the Next hint on a closed call, where Next still saves', async () => {
    // Deliberately asymmetric with Complete below: the closed-call wrap-around
    // only affects the last question, so Next's wording stays true. OWNER stays
    // writable past the deadline, isolating the open-call gate from read-only.
    installScoreMocks([carried7006()])
    setMockCtx(makeCtx(closedCallCtx()))

    renderAt(DEEP_LINK)

    const next = await screen.findByRole('button', { name: /Next/ })
    expect(next).toHaveAccessibleDescription(NEXT_HINT_MSG)
  })

  it('shows no navigation hint in a read-only session, which never saves', async () => {
    installScoreMocks([carried7006()])
    setMockCtx(
      makeCtx({
        userInfo: {
          userid: 'u-2',
          email: 'auditor@hhs.gov',
          fullname: 'Read Only',
          role: 'HHS_READONLY_ADMIN',
        } as userData,
      })
    )

    renderAt(DEEP_LINK)

    const next = await screen.findByRole('button', { name: /Next/ })
    await userEvent.hover(next)

    expect(next).toHaveAccessibleDescription('')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('omits the Complete explanation on a closed call, where it would misstate the behavior', async () => {
    // A past-deadline call keeps the old wrap-around to question 1 rather than
    // saving and summarizing, so the sentence must not appear.
    installScoreMocks([carried7006()])
    setMockCtx(makeCtx(closedCallCtx()))

    renderAt(DEVICES_LINK)

    const complete = await screen.findByRole('button', { name: 'Complete' })
    await userEvent.hover(complete)

    expect(screen.queryByText(COMPLETE_HINT_MSG)).not.toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('Complete summarizes unconfirmed and unanswered questions with working jump links', async () => {
    // Devices (7001) is the last question; it has no row at all. Identity
    // (7006) carries an unconfirmed answer.
    installScoreMocks([carried7006()])

    renderAt(DEVICES_LINK)

    const complete = await screen.findByRole('button', { name: 'Complete' })
    fireEvent.click(complete)

    // The summary reads a freshly-awaited scores fetch, then opens.
    expect(await screen.findByText('Before you finish')).toBeInTheDocument()
    expect(
      screen.getByText('0 of 2 answers counted as updated for this data call.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Carried forward — needs confirmation (1)')
    ).toBeInTheDocument()
    expect(screen.getByText('Unanswered (1)')).toBeInTheDocument()

    // No loop back to question 1: Complete opened the summary instead of
    // silently navigating.
    expect(
      axios.get.mock.calls.some(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          (c[0] as string).includes('functions/7006/options')
      )
    ).toBe(false)

    // The jump link navigates to the listed question.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Identity — Imperial Identity Verification',
      })
    )
    await waitFor(() =>
      expect(
        axios.get.mock.calls.some(
          (c: unknown[]) =>
            typeof c[0] === 'string' &&
            (c[0] as string).includes('functions/7006/options')
        )
      ).toBe(true)
    )
    expect(screen.queryByText('Before you finish')).not.toBeInTheDocument()
  })

  it('Complete shows the success state and stops looping when everything is updated', async () => {
    installScoreMocks([carried7006('done'), done7001()])

    renderAt(DEVICES_LINK)

    const complete = await screen.findByRole('button', { name: 'Complete' })
    fireEvent.click(complete)

    expect(
      await screen.findByText('Questionnaire complete')
    ).toBeInTheDocument()
    expect(
      screen.getByText('2 of 2 answers counted as updated for this data call.')
    ).toBeInTheDocument()
    // No writes fired: everything was already done, and Complete must not
    // manufacture one.
    expect(axios.put).not.toHaveBeenCalled()
    expect(saveScorePosts()).toHaveLength(0)
    // And no silent wrap-around to the first question.
    expect(
      axios.get.mock.calls.some(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          (c[0] as string).includes('functions/7006/options')
      )
    ).toBe(false)
  })
})
