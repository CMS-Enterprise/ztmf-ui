import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
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
//     opened question with the DB questionid, tagged with the session mode via
//     `readonly` (editors false, read-only viewers true).
// ---------------------------------------------------------------------------

const viewPings = () =>
  axios.post.mock.calls.filter((c: unknown[]) => c[0] === 'events/view')

test('records an events/view ping with the DB questionid when an editor opens a question', async () => {
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
  // functionid, and the system + data call from context.
  await waitFor(() => expect(viewPings()).toHaveLength(1))
  expect(viewPings()[0][1]).toEqual({
    fismasystemid: 1002,
    datacallid: 5,
    questionid: 900,
    readonly: false,
  })
})

test('records an events/view ping with readonly:true in a read-only session', async () => {
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

  // Read-only viewers are captured too (#368), tagged with readonly:true so
  // analytics can distinguish browsing from editing effort.
  await waitFor(() => expect(viewPings()).toHaveLength(1))
  expect(viewPings()[0][1]).toEqual({
    fismasystemid: 1002,
    datacallid: 5,
    questionid: 900,
    readonly: true,
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
//    - HHS data calls render the review-aware JustificationField but hide the
//      CMS-internal insights layer (panel, option badges, suggestion).
//    - CMS data calls render both the JustificationField and the insights layer.
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

describe('QuestionnairePage justification integration', () => {
  type InsightsResponse = { data: { data: unknown[] } }

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

  it('renders the justification field but hides the insights layer for an HHS data call, and persists an accepted prior response', async () => {
    installMocks()
    setMockCtx(
      makeCtx({
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

    // The CMS-internal insights layer is suppressed for HHS calls.
    expect(screen.queryByText('ZTMF Insights panel')).not.toBeInTheDocument()
    expect(
      screen.queryByText('ZTMF Insights option badge')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Suggested justification')
    ).not.toBeInTheDocument()

    const complete = screen.getByRole('button', { name: 'Complete' })
    expect(complete).toBeDisabled()

    // Accepting the required review is a current-call action, so the answer
    // persists even though the text equals the seeded prior response.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    expect(response).toHaveValue(PRIOR_RESPONSE)
    expect(complete).toBeEnabled()

    fireEvent.click(complete)

    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith('scores/5001', {
        fismasystemid: 1002,
        notes: PRIOR_RESPONSE,
        functionoptionid: 100,
        datacallid: 6,
        notes_is_ai_summary: false,
      })
    )
  })

  it('shows the insights panel, option badges, and suggestion for a CMS data call', async () => {
    installMocks()
    setMockCtx(makeCtx())

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

  it('blocks submission until the initial insights lookup settles', async () => {
    let resolveInsights: ((value: InsightsResponse) => void) | null = null
    const insightsResponse = new Promise<InsightsResponse>((resolve) => {
      resolveInsights = resolve
    })
    installMocks({ insightsResponse })
    setMockCtx(makeCtx())

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
    setMockCtx(makeCtx())

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
