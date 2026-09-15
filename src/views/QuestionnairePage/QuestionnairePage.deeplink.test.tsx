import { render, screen, waitFor, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
import QuestionnairePage from './QuestionnairePage'
import type { userData } from '@/types'
import { apiPaths } from '@/api/keys'

// Deep-link integration test for #500 / #732: a questionnaire URL reached by
// paste / refresh / bookmark (no router location.state) must resolve the
// system from :fismasystemid, the cycle from the datacall segment, and open the
// named :pillar/:function — not fail to load or snap to the first function.
// Pre-#732 acronym links redirect to the id form when they name exactly one
// system, and land on the dashboard with the not-found warning otherwise.

// config.ts reads import.meta.env, which jest can't parse; only the insight
// feature flag is reachable from this page, so a minimal default is enough.
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { INSIGHTS_SUGGEST_FIX_ENABLED: false },
}))

const notifyMock = jest.fn()
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return {
    ...actual,
    notify: (...args: unknown[]) => notifyMock(...args),
  }
})

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
  hasDeclinedDraft: jest.fn().mockResolvedValue(false),
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
    opdivs: [],
    opdivsLoaded: true,
  }

  mockGet.mockImplementation((url: string) => {
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.startsWith(apiPaths.scores.root))
      return Promise.resolve({ data: { data: [] } })
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
    [
      { path: AppRoutes.QUESTIONNAIRE, element: <QuestionnairePage /> },
      { path: '/', element: <div>dashboard</div> },
    ],
    { initialEntries: [entry] }
  )
  render(<RouterProvider router={router} />)
  return router
}

const optionsCalls = () =>
  mockGet.mock.calls
    .map((c) => c[0] as string)
    .filter((u) => u.includes('/options'))

const callsTo = (fragment: string) =>
  mockGet.mock.calls
    .map((c) => c[0] as string)
    .filter((u) => u.includes(fragment))

it('resolves the system from :fismasystemid on a cold load (no location.state)', async () => {
  renderAt(
    '/questionnaire/1002/FY2025_Death_Star_Assessment/networks/imperial-network-security'
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
    '/questionnaire/1002/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  await waitFor(() =>
    expect(
      mockGet.mock.calls.some(
        (c) =>
          typeof c[0] === 'string' &&
          c[0].startsWith(apiPaths.scores.root) &&
          c[0].includes('datacallid=4')
      )
    ).toBe(true)
  )
  // The latest call (5) must NOT be the one queried for scores.
  expect(
    mockGet.mock.calls.some(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].startsWith(apiPaths.scores.root) &&
        c[0].includes('datacallid=5')
    )
  ).toBe(false)
})

it('opens the deep-linked :pillar/:function instead of the first', async () => {
  renderAt(
    '/questionnaire/1002/FY2025_Death_Star_Assessment/networks/imperial-network-security'
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
  renderAt('/questionnaire/1002')

  // No pillar/function in the URL -> first pillar (Identity, 7006).
  await waitFor(() =>
    expect(
      optionsCalls().some((u) => u.includes('functions/7006/options'))
    ).toBe(true)
  )
})

it('shows a not-found warning once systems are loaded and the id is unknown', async () => {
  renderAt(
    '/questionnaire/4242/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  await waitFor(() =>
    expect(screen.getByText(/Could not find a system/i)).toBeInTheDocument()
  )
  // The decommissioned list was consulted before concluding.
  expect(callsTo('fismasystems?decommissioned=true')).toHaveLength(1)
  expect(callsTo('/questions')).toHaveLength(0)
})

it('opens a system whose acronym contains a slash (misc#382)', async () => {
  mockCtx.fismaSystems = [
    ...(mockCtx.fismaSystems as unknown[]),
    {
      fismasystemid: 1003,
      fismaacronym: 'ALLIANCE/FLEET',
      fismaname: 'Rebel Alliance Fleet Communications',
      datacenterenvironment: 'Imperial-Fleet',
    },
  ]
  const router = renderAt('/questionnaire/1003/FY2025_Death_Star_Assessment')

  await waitFor(() =>
    expect(callsTo('/fismasystems/1003/questions')).toHaveLength(1)
  )
  // The canonical redirect keeps the id form; the acronym never enters the URL
  // where its slash would split the path into acronym + datacall.
  await waitFor(() =>
    expect(router.state.location.pathname).toMatch(
      /^\/questionnaire\/1003\/FY2025_Death_Star_Assessment\/identity\//
    )
  )
  expect(screen.queryByText(/Could not find a system/i)).not.toBeInTheDocument()
})

// Pre-#732 links carried the acronym. They still work when the acronym names
// exactly one system: the page rewrites the first segment to the id in place
// (replace, so Back does not bounce through the legacy form) and keeps the
// datacall / pillar / function tail. Acronyms are not unique, though: several
// production systems shared "Pending", and guessing the first match once
// saved a client's answers against another system (misc#386). Zero or several
// matches therefore land on the dashboard with the not-found warning.
describe('legacy acronym links', () => {
  const PENDING_A = {
    fismasystemid: 2001,
    fismaacronym: 'Pending',
    fismaname: 'First Pending System',
    datacenterenvironment: 'Imperial-Fleet',
  }
  const PENDING_B = {
    fismasystemid: 2002,
    fismaacronym: 'Pending',
    fismaname: 'Second Pending System',
    datacenterenvironment: 'Imperial-Fleet',
  }
  beforeEach(() => {
    mockCtx.fismaSystems = [
      ...(mockCtx.fismaSystems as unknown[]),
      PENDING_A,
      PENDING_B,
    ]
  })

  it('redirects a unique acronym to the id form, keeping the deep-link tail', async () => {
    const router = renderAt(
      '/questionnaire/ssd-ex/FY2025_Death_Star_Assessment/networks/imperial-network-security'
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/questionnaire/1002/FY2025_Death_Star_Assessment/networks/imperial-network-security'
      )
    )
    // Replace, not push: the legacy URL leaves no history entry behind.
    expect(router.state.historyAction).toBe('REPLACE')
    // The redirected page then loads the right system and the deep-linked
    // question, exactly as an id link would.
    await waitFor(() =>
      expect(
        optionsCalls().some((u) => u.includes('functions/7003/options'))
      ).toBe(true)
    )
    expect(callsTo('/fismasystems/1002/questions')).toHaveLength(1)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('redirects a bare acronym link to the bare id form', async () => {
    const router = renderAt('/questionnaire/SSD-EX')
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/questionnaire\/1002/)
    )
    await waitFor(() =>
      expect(callsTo('/fismasystems/1002/questions')).toHaveLength(1)
    )
  })

  it('sends an ambiguous acronym to the dashboard with the not-found warning', async () => {
    const router = renderAt('/questionnaire/pending')

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(router.state.historyAction).toBe('REPLACE')
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringMatching(/Could not find a system matching “pending”/),
      'warning'
    )
    // Neither candidate's questionnaire was opened.
    expect(callsTo('/questions')).toHaveLength(0)
  })

  it('sends an unknown acronym to the dashboard with the not-found warning', async () => {
    const router = renderAt(
      '/questionnaire/does-not-exist/FY2025_Death_Star_Assessment'
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /Could not find a system matching “does-not-exist”/
      ),
      'warning'
    )
    // The decommissioned list was consulted before concluding.
    expect(callsTo('fismasystems?decommissioned=true')).toHaveLength(1)
  })

  it('ignores route state: only the URL decides which system opens', async () => {
    // The #734 hotfix carried the id in route state. With the id in the URL
    // that fallback is gone, so a stale state entry cannot steer the redirect.
    const router = renderAt({
      pathname: '/questionnaire/pending',
      state: { fismasystemid: PENDING_B.fismasystemid },
    })

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(callsTo('/questions')).toHaveLength(0)
  })

  it('redirects a decommissioned acronym to its id form', async () => {
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
      if (url.includes('/fismasystems/1099/questions'))
        return Promise.resolve({ data: { data: null } })
      return Promise.resolve({ data: { data: [] } })
    })
    const router = renderAt(
      '/questionnaire/old-sys/FY2025_Death_Star_Assessment'
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/questionnaire/1099/FY2025_Death_Star_Assessment'
      )
    )
    await waitFor(() =>
      expect(
        screen.getByText(/No questionnaire is available for this system/i)
      ).toBeInTheDocument()
    )
  })
})

it('shows a spinner (not the not-found warning) while the systems list is still loading', () => {
  mockCtx.fismaSystems = []
  renderAt(
    '/questionnaire/1002/FY2025_Death_Star_Assessment/networks/imperial-network-security'
  )

  expect(screen.queryByText(/Could not find a system/i)).not.toBeInTheDocument()
})

it('runs the fetch exactly once per cold deep-link mount (no self-triggered rerun)', async () => {
  renderAt(
    '/questionnaire/1002/FY2025_Death_Star_Assessment/networks/imperial-network-security'
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
  expect(callsTo(`${apiPaths.scores.root}?`)).toHaveLength(1)
  expect(optionsCalls()).toHaveLength(1)
})

it('runs the fetch exactly once for the dashboard flow too (route state present)', async () => {
  renderAt({
    pathname: '/questionnaire/1002',
    state: {
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
  expect(callsTo(`${apiPaths.scores.root}?`)).toHaveLength(1)
  expect(callsTo(`${apiPaths.scores.root}?`)[0]).toContain('datacallid=5')
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
    if (url.startsWith(apiPaths.scores.root))
      return Promise.resolve({ data: { data: [] } })
    if (url.includes('insights')) return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: { data: [] } })
  })

  renderAt('/questionnaire/1099/FY2025_Death_Star_Assessment')

  await waitFor(() =>
    expect(
      screen.getByText(/No questionnaire is available for this system/i)
    ).toBeInTheDocument()
  )
  expect(screen.queryByText(/Could not find a system/i)).not.toBeInTheDocument()
})

it('still warns not-found when the id is in neither the active nor the decommissioned list', async () => {
  renderAt('/questionnaire/9999/FY2025_Death_Star_Assessment')

  await waitFor(() =>
    expect(screen.getByText(/Could not find a system/i)).toBeInTheDocument()
  )
  // The decommissioned list was actually consulted before concluding.
  expect(callsTo('fismasystems?decommissioned=true')).toHaveLength(1)
})
