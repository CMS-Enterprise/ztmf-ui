import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
import QuestionnairePage from './QuestionnairePage'
import type { userData } from '@/types'

// ztmf-misc#289: the questionnaire hides Devices and Applications for SaaS, but
// only from FY26 on. The filter used to run on every call, hiding answered
// history from closed cycles. The sidebar uppercases pillar names and spells out
// CrossCutting, so the assertions read what the ISSO sees.

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

// Later cycle, deliberately with a LOWER datacallid so an id-ordered threshold
// would fail these tests too.
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

const PILLARS = [
  'Identity',
  'Devices',
  'Networks',
  'Applications',
  'Data',
  'CrossCutting',
]

const QUESTIONS = PILLARS.map((pillar, i) => ({
  questionid: 900 + i,
  question: `Question for ${pillar}`,
  notesprompt: 'Notes',
  pillar: { pillar },
  function: {
    functionid: 7000 + i,
    function: `${pillar} Function`,
    description: `${pillar} Function description`,
    datacenterenvironment: 'SaaS',
  },
}))

function makeCtx(
  selectedDatacall: typeof CURRENT_CALL,
  latest: typeof CURRENT_CALL = CURRENT_CALL
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
    fismaSystems: [
      {
        fismasystemid: 2001,
        fismaacronym: 'SAAS-EX',
        fismaname: 'SaaS Example System',
        datacenterenvironment: 'SaaS',
      },
    ],
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
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })
})

function renderPage() {
  const router = createMemoryRouter(
    [{ path: AppRoutes.QUESTIONNAIRE, element: <QuestionnairePage /> }],
    { initialEntries: ['/questionnaire/saas-ex'] }
  )
  return render(<RouterProvider router={router} />)
}

it('hides Devices and Applications on the current cycle for a SaaS system', async () => {
  mockCtx = makeCtx(CURRENT_CALL)
  renderPage()

  // The in-scope pillars prove the absences below are the filter, not a bad render.
  await screen.findByText('IDENTITY')
  expect(screen.getByText('NETWORKS')).toBeInTheDocument()
  expect(screen.getByText('DATA')).toBeInTheDocument()
  expect(screen.getByText('CROSS CUTTING')).toBeInTheDocument()

  expect(screen.queryByText('DEVICES')).not.toBeInTheDocument()
  expect(screen.queryByText('APPLICATIONS')).not.toBeInTheDocument()
})

it('shows every pillar on a cycle earlier than FY26 for the same SaaS system', async () => {
  mockCtx = makeCtx(HISTORICAL_CALL)
  renderPage()

  await screen.findByText('IDENTITY')
  await waitFor(() => {
    expect(screen.getByText('DEVICES')).toBeInTheDocument()
  })
  expect(screen.getByText('APPLICATIONS')).toBeInTheDocument()
})

it('keeps filtering on cycles AFTER FY26, not just the latest one', async () => {
  mockCtx = makeCtx(FUTURE_CALL, FUTURE_CALL)
  renderPage()

  await screen.findByText('IDENTITY')
  expect(screen.queryByText('DEVICES')).not.toBeInTheDocument()
  expect(screen.queryByText('APPLICATIONS')).not.toBeInTheDocument()
})

it('keeps filtering FY26 once a later cycle has opened', async () => {
  // The regression a latest-only gate would cause.
  mockCtx = makeCtx(CURRENT_CALL, FUTURE_CALL)
  renderPage()

  await screen.findByText('IDENTITY')
  expect(screen.queryByText('DEVICES')).not.toBeInTheDocument()
  expect(screen.queryByText('APPLICATIONS')).not.toBeInTheDocument()
})
