import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
import QuestionnairePage from './QuestionnairePage'
import type { userData } from '@/types'

// Cross-navigation coverage for ui#610: the questionnaire header needs a link
// back to System Info and a Pillar Scores button, alongside the existing
// Compare Datacalls button.

jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { INSIGHTS_SUGGEST_FIX_ENABLED: false },
}))

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))
const mockGet = require('@/axiosConfig').default.get as jest.Mock

// draftStore uses crypto.subtle (unavailable in jsdom); stub to no-ops.
jest.mock('./draftStore', () => ({
  saveDraft: jest.fn().mockResolvedValue(true),
  loadDraft: jest.fn().mockResolvedValue(null),
  clearDraft: jest.fn().mockResolvedValue(undefined),
}))

// notify() reaches notistack's standalone enqueueSnackbar, which needs a
// mounted provider; keep isAuthHandled real so the error path is exercised as
// written (same pattern as QuestionnairePage.test).
const notifyMock = jest.fn()
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return {
    ...actual,
    notify: (...args: unknown[]) => notifyMock(...args),
  }
})

let mockCtx: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

const QUESTIONS = [
  {
    questionid: 900,
    question: 'Question for Imperial Identity Verification',
    notesprompt: 'Notes',
    pillar: { pillar: 'Identity' },
    function: {
      functionid: 7006,
      function: 'Imperial Identity Verification',
      description: 'Imperial Identity Verification description',
      datacenterenvironment: 'Imperial-Fleet',
    },
  },
]

const AGGREGATE = [
  {
    datacallid: 5,
    fismasystemid: 1002,
    systemscore: 3.75,
    pillarscores: [{ pillarid: 1, pillar: 'Identity', score: 3.5 }],
  },
]

function makeCtx(role: userData['role'] | undefined) {
  return {
    userInfo: {
      userid: '1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role,
    } as userData,
    latestDataCallId: 5,
    latestDatacall: 'Audit Fields Smoke Cycle',
    latestDeadline: '2099-12-31T23:59:59Z',
    selectedDatacall: {
      datacallid: 5,
      datacall: 'Audit Fields Smoke Cycle',
      datecreated: '',
      deadline: '2099-12-31T23:59:59Z',
    },
    datacalls: [
      {
        datacallid: 5,
        datacall: 'Audit Fields Smoke Cycle',
        datecreated: '',
        deadline: '2099-12-31T23:59:59Z',
      },
    ],
    activeDatacallIds: [5],
    fismaSystems: [
      {
        fismasystemid: 1002,
        fismaacronym: 'SSD-EX',
        fismaname: 'Super Star Destroyer Executor Command Systems',
        datacenterenvironment: 'Imperial-Fleet',
      },
    ],
    setFismaSystems: jest.fn(),
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    fetchFismaSystems: jest.fn(),
    datacenterEnvironments: [],
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCtx = makeCtx('OWNER')
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.includes('/scores/aggregate'))
      return Promise.resolve({ data: { data: AGGREGATE } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('/options')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('insights')) return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })
})

// Data-router harness matching the app's createHashRouter, per the note in
// QuestionnairePage.deeplink.test: a plain MemoryRouter hands the component the
// unstable useNavigate and re-runs the fetch effect on the canonical redirect.
function renderPage() {
  const router = createMemoryRouter(
    [
      { path: AppRoutes.QUESTIONNAIRE, element: <QuestionnairePage /> },
      { path: '/systems/:fismasystemid', element: <div>system detail</div> },
    ],
    { initialEntries: ['/questionnaire/ssd-ex'] }
  )
  render(<RouterProvider router={router} />)
  return router
}

const aggregateCalls = () =>
  mockGet.mock.calls
    .map((c) => c[0] as string)
    .filter((u) => typeof u === 'string' && u.includes('/scores/aggregate'))

it('navigates to the system detail page keyed on fismasystemid', async () => {
  const router = renderPage()
  const button = await screen.findByRole('button', { name: 'System Info' })
  await userEvent.click(button)
  // The questionnaire route carries the acronym; the detail route is keyed on
  // the id, so this proves the acronym was resolved to 1002 before linking.
  expect(router.state.location.pathname).toBe('/systems/1002')
})

it('suppresses System Info when the role fails the system-access gate', async () => {
  mockCtx = makeCtx(undefined)
  renderPage()
  // Compare Datacalls is ungated, so its presence proves the header rendered
  // and only the gated button is missing.
  await screen.findByRole('button', { name: 'Compare Datacalls' })
  expect(
    screen.queryByRole('button', { name: 'System Info' })
  ).not.toBeInTheDocument()
})

it('fetches the pillar aggregate for this system and opens the modal', async () => {
  renderPage()
  const button = await screen.findByRole('button', { name: 'Pillar Scores' })
  expect(aggregateCalls()).toHaveLength(0)
  await userEvent.click(button)

  await waitFor(() =>
    expect(
      aggregateCalls().some(
        (u) =>
          u.includes('fismasystemid=1002') && u.includes('include_pillars=true')
      )
    ).toBe(true)
  )
  // Acronym in the title comes from the resolved system, not the lowercased
  // URL param, so it matches the dashboard's casing.
  expect(
    await screen.findByText(
      /Super Star Destroyer Executor Command Systems \(SSD-EX\) - Pillar Scores/
    )
  ).toBeInTheDocument()
})

it('keeps the modal closed when the aggregate fetch fails', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/scores/aggregate'))
      return Promise.reject(new Error('boom'))
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    return Promise.resolve({ data: { data: [] } })
  })
  jest.spyOn(console, 'error').mockImplementation(() => {})

  renderPage()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Pillar Scores' })
  )

  await waitFor(() => expect(aggregateCalls()).not.toHaveLength(0))
  // An empty modal would read as "this system has no scores"; nothing opens and
  // the user is told instead.
  await waitFor(() =>
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringContaining('error occurred'),
      'error'
    )
  )
  expect(screen.queryByText(/- Pillar Scores/)).not.toBeInTheDocument()
})
