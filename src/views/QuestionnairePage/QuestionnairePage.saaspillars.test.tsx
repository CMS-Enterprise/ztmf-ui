import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
import QuestionnairePage from './QuestionnairePage'
import type { userData } from '@/types'

// ztmf-misc#289 / ztmf#545: the reduced-pillar rule now lives in the API, which
// applies it to the cycle named by the `datacallid` param. The page's remaining
// job is to ask for the cycle the ISSO is actually viewing and render the answer
// verbatim. These tests pin both halves: the param sent, and the absence of any
// surviving client-side filter. The sidebar uppercases pillar names and spells
// out CrossCutting, so the assertions read what the ISSO sees.

jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { INSIGHTS_SUGGEST_FIX_ENABLED: false },
}))

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))
const mockGet = require('@/axiosConfig').default.get as jest.Mock

jest.mock('./draftStore', () => ({
  saveDraft: jest.fn().mockResolvedValue(true),
  loadDraft: jest.fn().mockResolvedValue(null),
  clearDraft: jest.fn().mockResolvedValue(undefined),
  hasDeclinedDraft: jest.fn().mockResolvedValue(false),
}))

jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

let mockCtx: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

const CURRENT_CALL = {
  datacallid: 5,
  datacall: 'FY2026 ZTM',
  datecreated: '',
  deadline: '2026-09-11T23:59:59Z',
}

// Later cycle, deliberately with a LOWER datacallid so a test that passed by
// id ordering rather than by the requested cycle would fail here.
const FUTURE_CALL = {
  datacallid: 4,
  datacall: 'FY2027 ZTM',
  datecreated: '',
  deadline: '2027-09-11T23:59:59Z',
}

const HISTORICAL_CALL = {
  datacallid: 3,
  datacall: 'FY2025 Q3',
  datecreated: '',
  deadline: '2025-05-07T23:59:59Z',
}

const ALL_PILLARS = [
  'Identity',
  'Devices',
  'Networks',
  'Applications',
  'Data',
  'CrossCutting',
]
const REDUCED_PILLARS = ALL_PILLARS.filter(
  (p) => p !== 'Devices' && p !== 'Applications'
)

const questionsFor = (pillars: string[]) =>
  pillars.map((pillar) => ({
    questionid: 900 + ALL_PILLARS.indexOf(pillar),
    question: `Question for ${pillar}`,
    notesprompt: 'Notes',
    pillar: { pillar },
    function: {
      functionid: 7000 + ALL_PILLARS.indexOf(pillar),
      function: `${pillar} Function`,
      description: `${pillar} Function description`,
      datacenterenvironment: 'SaaS',
    },
  }))

// Stands in for the API's seeded rule: the two FY26-onward cycles serve the
// reduced set, the pre-anchor cycle the full one. A request with no datacallid
// gets the full catalog, matching the endpoint's unparameterized contract - so
// a page that forgets the param renders Devices and fails the assertions below.
const QUESTIONS_BY_DATACALL: Record<string, string[]> = {
  [CURRENT_CALL.datacallid]: REDUCED_PILLARS,
  [FUTURE_CALL.datacallid]: REDUCED_PILLARS,
  [HISTORICAL_CALL.datacallid]: ALL_PILLARS,
}

// Only environments carrying a seeded rule row are reduced; the control system
// is on AWS, so the API serves it all six pillars on every cycle.
const SAAS_SYSTEM = {
  fismasystemid: 2001,
  fismaacronym: 'SAAS-EX',
  fismaname: 'SaaS Example System',
  datacenterenvironment: 'SaaS',
}
const NON_SAAS_SYSTEM = {
  fismasystemid: 2002,
  fismaacronym: 'AWS-EX',
  fismaname: 'AWS Example System',
  datacenterenvironment: 'AWS',
}

/** The datacallid the page put on its questions request. */
function requestedDataCallId(): string | null {
  const call = mockGet.mock.calls
    .map(([url]: [string]) => String(url))
    .find((url) => url.includes('/questions'))
  if (!call) return null
  return new URLSearchParams(call.split('?')[1] ?? '').get('datacallid')
}

function makeCtx(
  selectedDatacall: typeof CURRENT_CALL,
  latest: typeof CURRENT_CALL = CURRENT_CALL,
  system: typeof SAAS_SYSTEM = SAAS_SYSTEM
) {
  return {
    userInfo: {
      userid: '1',
      email: 'isso@example.hhs',
      fullname: 'Test ISSO',
      role: 'OWNER',
    } as userData,
    latestDataCallId: latest.datacallid,
    latestDatacall: latest.datacall,
    latestDeadline: latest.deadline,
    selectedDatacall,
    datacalls: [FUTURE_CALL, CURRENT_CALL, HISTORICAL_CALL],
    activeDatacallIds: [latest.datacallid],
    fismaSystems: [system],
    setFismaSystems: jest.fn(),
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    fetchFismaSystems: jest.fn(),
    datacenterEnvironments: [
      {
        datacenterenvironment: 'SaaS',
        category: 'SaaS',
        scoring_key: 'SaaS',
        selectable: true,
        ordr: 60,
      },
    ],
    opdivs: [],
    opdivsLoaded: true,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/questions')) {
      const reduced = url.includes(
        `/fismasystems/${SAAS_SYSTEM.fismasystemid}/`
      )
      const id = new URLSearchParams(url.split('?')[1] ?? '').get('datacallid')
      // No datacallid means the full catalog, matching the endpoint's
      // unparameterized contract.
      const pillars =
        (reduced && id ? QUESTIONS_BY_DATACALL[id] : undefined) ?? ALL_PILLARS
      return Promise.resolve({ data: { data: questionsFor(pillars) } })
    }
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })
})

function renderPage(slug = 'saas-ex') {
  const router = createMemoryRouter(
    [{ path: AppRoutes.QUESTIONNAIRE, element: <QuestionnairePage /> }],
    { initialEntries: [`/questionnaire/${slug}`] }
  )
  return render(<RouterProvider router={router} />)
}

it('renders the reduced set the API serves for the current cycle', async () => {
  mockCtx = makeCtx(CURRENT_CALL)
  renderPage()

  // The in-scope pillars prove the absences below are the API's reduced set,
  // not a bad render.
  await screen.findAllByText('Identity')
  expect(screen.getAllByText('Networks').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Data').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Cross-cutting').length).toBeGreaterThan(0)

  expect(screen.queryAllByText('Devices')).toHaveLength(0)
  expect(screen.queryAllByText('Applications')).toHaveLength(0)
  expect(requestedDataCallId()).toBe(String(CURRENT_CALL.datacallid))
})

it('shows every pillar on a cycle earlier than FY26 for the same SaaS system', async () => {
  mockCtx = makeCtx(HISTORICAL_CALL)
  renderPage()

  await screen.findAllByText('Identity')
  await waitFor(() => {
    expect(screen.getAllByText('Devices').length).toBeGreaterThan(0)
  })
  expect(screen.getAllByText('Applications').length).toBeGreaterThan(0)
  expect(requestedDataCallId()).toBe(String(HISTORICAL_CALL.datacallid))
})

it('asks for a later cycle when that is the one being viewed', async () => {
  mockCtx = makeCtx(FUTURE_CALL, FUTURE_CALL)
  renderPage()

  await screen.findAllByText('Identity')
  expect(requestedDataCallId()).toBe(String(FUTURE_CALL.datacallid))
  expect(screen.queryAllByText('Devices')).toHaveLength(0)
  expect(screen.queryAllByText('Applications')).toHaveLength(0)
})

it('asks for the viewed cycle, not the latest one', async () => {
  // The regression a latestDataCallId-keyed request would cause: viewing the
  // closed FY26 cycle while FY27 is open must not ask the API about FY27.
  mockCtx = makeCtx(HISTORICAL_CALL, FUTURE_CALL)
  renderPage()

  await screen.findAllByText('Identity')
  expect(requestedDataCallId()).toBe(String(HISTORICAL_CALL.datacallid))
  await waitFor(() => {
    expect(screen.getAllByText('Devices').length).toBeGreaterThan(0)
  })
})

it.each([
  ['the in-scope cycle', CURRENT_CALL],
  ['a later cycle', FUTURE_CALL],
  ['a pre-anchor cycle', HISTORICAL_CALL],
])(
  'keeps all six pillars for a non-SaaS system on %s',
  async (_label, call) => {
    // Only environments with a seeded rule row are reduced. Without this control
    // a filter that keyed on something other than the environment - or reduced
    // everything on an in-scope cycle - would pass every other test here.
    mockCtx = makeCtx(call, call, NON_SAAS_SYSTEM)
    renderPage('aws-ex')

    await screen.findAllByText('Identity')
    await waitFor(() => {
      expect(screen.getAllByText('Devices').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('Applications').length).toBeGreaterThan(0)
    expect(requestedDataCallId()).toBe(String(call.datacallid))
  }
)

it('never re-filters the response client-side', async () => {
  // The point of ztmf#545: if a client-side pillar filter came back, this SaaS
  // system on an in-scope cycle would drop pillars the API deliberately served.
  mockCtx = makeCtx(CURRENT_CALL)
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: questionsFor(ALL_PILLARS) } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })
  renderPage()

  await screen.findAllByText('Identity')
  await waitFor(() => {
    expect(screen.getAllByText('Devices').length).toBeGreaterThan(0)
  })
  expect(screen.getAllByText('Applications').length).toBeGreaterThan(0)
})
