import { render, screen, waitFor, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
import QuestionnairePage from './QuestionnairePage'
import type { userData } from '@/types'

// Deep-link integration test for #500: a questionnaire URL reached by paste /
// refresh / bookmark (no router location.state) must resolve the system from
// :fismaacronym, the cycle from the datacall segment, and open the named
// :pillar/:function — not fail to load or snap to the first function.

// config.ts reads import.meta.env, which jest can't parse; only the insight
// feature flag is reachable from this page, so a minimal default is enough.
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

// The page reads its shared state via useContextProp (useOutletContext).
let mockCtx: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

// Seed shape mirrors GET /fismasystems/:id/questions (empire data, SSD-EX).
const PILLARS: [string, number, string][] = [
  ['Identity', 7006, 'Imperial Identity Verification'],
  ['Devices', 7001, 'Imperial Device Management'],
  ['Networks', 7003, 'Imperial Network Security'],
  ['Applications', 7002, 'Fleet Application Security'],
  ['Data', 7004, 'Fleet Data Protection'],
  ['CrossCutting', 7005, 'Imperial Cross-Cutting Controls'],
]

const QUESTIONS = PILLARS.map(([pillar, functionid, fn], i) => ({
  questionid: 900 + i,
  question: `Question for ${fn}`,
  notesprompt: 'Notes',
  pillar: { pillar },
  function: {
    functionid,
    function: fn,
    description: `${fn} description`,
    datacenterenvironment: 'Imperial-Fleet',
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockCtx = {
    userInfo: {
      userid: '1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role: 'OWNER',
    } as userData,
    // Latest is call 5; the deep link below names call 4 — so a scores query
    // for datacallid=4 proves the cycle was resolved from the URL, not defaulted.
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
      {
        datacallid: 4,
        datacall: 'FY2025 Death Star Assessment',
        datecreated: '',
        deadline: '2025-03-31T23:59:59Z',
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

  mockGet.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('/options')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('insights')) return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })
})

// Data-router harness (createMemoryRouter + RouterProvider) to match the real
// app (createHashRouter): data routers hand components the stable useNavigate,
// while plain <MemoryRouter> gets the pathname-keyed unstable one, whose
// identity change on the canonical redirect re-runs the fetch effect and makes
// exact-count assertions lie about production behavior.
function renderAt(entry: string | { pathname: string; state: unknown }) {
  const router = createMemoryRouter(
    [{ path: AppRoutes.QUESTIONNAIRE, element: <QuestionnairePage /> }],
    { initialEntries: [entry] }
  )
  return render(<RouterProvider router={router} />)
}

const optionsCalls = () =>
  mockGet.mock.calls
    .map((c) => c[0] as string)
    .filter((u) => u.includes('/options'))

const callsTo = (fragment: string) =>
  mockGet.mock.calls
    .map((c) => c[0] as string)
    .filter((u) => u.includes(fragment))

it('resolves the system from :fismaacronym on a cold load (no location.state)', async () => {
  renderAt(
    '/questionnaire/ssd-ex/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  // The old failure mode was this warning; it must not appear now.
  await waitFor(() =>
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/fismasystems/1002/questions'),
      expect.anything()
    )
  )
  expect(screen.queryByText(/Could not find a system/i)).not.toBeInTheDocument()
})

it('resolves the cycle from the URL datacall segment (not the latest/selected call)', async () => {
  renderAt(
    '/questionnaire/ssd-ex/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  await waitFor(() =>
    expect(
      mockGet.mock.calls.some(
        (c) =>
          typeof c[0] === 'string' &&
          c[0].startsWith('scores') &&
          c[0].includes('datacallid=4')
      )
    ).toBe(true)
  )
  // The latest call (5) must NOT be the one queried for scores.
  expect(
    mockGet.mock.calls.some(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].startsWith('scores') &&
        c[0].includes('datacallid=5')
    )
  ).toBe(false)
})

it('opens the deep-linked :pillar/:function instead of the first', async () => {
  renderAt(
    '/questionnaire/ssd-ex/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  // Networks/Imperial Network Security is functionid 7003; the first pillar
  // (Identity) is 7006. Honoring the URL means we fetch options for 7003.
  await waitFor(() =>
    expect(
      optionsCalls().some((u) => u.includes('functions/7003/options'))
    ).toBe(true)
  )
  expect(optionsCalls().some((u) => u.includes('functions/7006/options'))).toBe(
    false
  )
})

it('falls back to the first function when the URL omits :pillar/:function', async () => {
  renderAt('/questionnaire/ssd-ex')

  // No pillar/function in the URL -> first pillar (Identity, 7006).
  await waitFor(() =>
    expect(
      optionsCalls().some((u) => u.includes('functions/7006/options'))
    ).toBe(true)
  )
})

it('shows a not-found warning once systems are loaded and the acronym is unknown', async () => {
  renderAt(
    '/questionnaire/does-not-exist/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  await waitFor(() =>
    expect(screen.getByText(/Could not find a system/i)).toBeInTheDocument()
  )
})

it('shows a spinner (not the not-found warning) while the systems list is still loading', () => {
  mockCtx.fismaSystems = []
  renderAt(
    '/questionnaire/ssd-ex/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  expect(screen.queryByText(/Could not find a system/i)).not.toBeInTheDocument()
})

it('runs the fetch exactly once per cold deep-link mount (no self-triggered rerun)', async () => {
  renderAt(
    '/questionnaire/ssd-ex/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  // Settle: the deep-linked question's options request marks the end of the
  // load chain; give any (buggy) second effect pass time to fire after it.
  await waitFor(() =>
    expect(
      optionsCalls().some((u) => u.includes('functions/7003/options'))
    ).toBe(true)
  )
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })

  expect(callsTo('/fismasystems/1002/questions')).toHaveLength(1)
  expect(callsTo('scores?')).toHaveLength(1)
  expect(optionsCalls()).toHaveLength(1)
})

it('runs the fetch exactly once for the dashboard flow too (route state present)', async () => {
  renderAt({
    pathname: '/questionnaire/ssd-ex',
    state: {
      fismasystemid: 1002,
      datacallid: 5,
      datacall: 'Audit Fields Smoke Cycle',
      deadline: '2099-12-31T23:59:59Z',
    },
  })

  await waitFor(() => expect(optionsCalls().length).toBeGreaterThan(0))
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })

  // Route state wins (#467/#501): scores queried for the opened call, once.
  expect(callsTo('scores?')).toHaveLength(1)
  expect(callsTo('scores?')[0]).toContain('datacallid=5')
  expect(callsTo('/fismasystems/1002/questions')).toHaveLength(1)
})

it('resolves a decommissioned system and shows its no-questionnaire state, not the not-found warning', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('fismasystems?decommissioned=true'))
      return Promise.resolve({
        data: {
          data: [
            {
              fismasystemid: 1099,
              fismaacronym: 'OLD-SYS',
              fismaname: 'Retired Imperial System',
              datacenterenvironment: 'Imperial-Fleet',
              decommissioned: true,
            },
          ],
        },
      })
    // Decommissioned systems join to zero functions; backend serializes null.
    if (url.includes('/fismasystems/1099/questions'))
      return Promise.resolve({ data: { data: null } })
    if (url.startsWith('scores')) return Promise.resolve({ data: { data: [] } })
    if (url.includes('insights')) return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })

  renderAt('/questionnaire/old-sys/FY2025_Death_Star_Assessment')

  await waitFor(() =>
    expect(
      screen.getByText(/No questionnaire is available for this system/i)
    ).toBeInTheDocument()
  )
  expect(screen.queryByText(/Could not find a system/i)).not.toBeInTheDocument()
})

it('still warns not-found when the acronym is in neither the active nor the decommissioned list', async () => {
  renderAt('/questionnaire/nope/FY2025_Death_Star_Assessment')

  await waitFor(() =>
    expect(screen.getByText(/Could not find a system/i)).toBeInTheDocument()
  )
  // The decommissioned list was actually consulted before concluding.
  expect(callsTo('fismasystems?decommissioned=true')).toHaveLength(1)
})
