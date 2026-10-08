/**
 * Integration smoke test for the assembled dashboard.
 *
 * The pure modules are pinned separately; what this covers is the wiring -
 * that the page composes without crashing, shows real figures rather than
 * placeholders, and offers each header action only to the tier the backend
 * would accept it from.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType, OpDiv, UserRole, userData } from '@/types'
import { EXTREMES_PER_END } from './opdivAggregates'

const OPDIV: OpDiv = {
  opdiv_id: 7,
  code: 'NIH',
  name: 'National Institutes of Health',
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
  insights_enabled: false,
}

const OTHER_OPDIV: OpDiv = {
  opdiv_id: 9,
  code: 'CDC',
  name: 'Centers for Disease Control',
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
  insights_enabled: false,
}

let mockUser: userData
let mockSystems: FismaSystemType[]
let mockScoreRows: {
  datacallid: number
  fismasystemid: number
  systemscore: number
  systemtier: string
}[]
let mockUsers: userData[]
let mockOpDivId: string
let mockHistory: {
  datacallid: number
  fismasystemid: number
  systemscore: number
}[]
const mockCalls: string[] = []
const mockUpdate = jest.fn()
const mockDelegate = jest.fn()
const mockNotify = jest.fn()
let mockContext: Record<string, unknown>
let mockScoresError: boolean
let mockUsersError: boolean
const mockSetShowDecommissioned = jest.fn()

// The axios instance transitively pulls in the hash router and LoginPage,
// whose config module reads import.meta - not transformable under jest. Every
// suite that touches a fetching module stubs it the same way.
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ opdivId: mockOpDivId }),
  }
})

jest.mock('../Title/Context', () => ({
  useContextProp: () => ({
    fismaSystems: mockSystems,
    fismaSystemsLoaded: true,
    setFismaSystems: jest.fn(),
    userInfo: mockUser,
    latestDataCallId: 104,
    latestDatacall: 'FY26 ZTM',
    latestDeadline: '2026-09-11',
    datacalls: [
      {
        datacallid: 104,
        datacall: 'FY26 ZTM',
        datecreated: '2025-10-01',
        deadline: '2026-09-11',
      },
    ],
    activeDatacallIds: [104],
    selectedDatacall: {
      datacallid: 104,
      datacall: 'FY26 ZTM',
      datecreated: '2025-10-01',
      deadline: '2026-09-11',
    },
    setSelectedDatacall: jest.fn(),
    toggleActiveDatacall: jest.fn(),
    showDecommissioned: false,
    setShowDecommissioned: mockSetShowDecommissioned,
    fetchFismaSystems: jest.fn(),
    dashboardSearch: '',
    setDashboardSearch: jest.fn(),
    datacenterEnvironments: [],
    opdivs: [OPDIV, OTHER_OPDIV],
    opdivsLoaded: true,
    ...mockContext,
  }),
}))

// The datacall picker and the systems grid are exercised by their own suites
// and pull in heavy grid/vocabulary deps; this test is about the summary.
jest.mock('@/components/DatacallContextCard/DatacallContextCard', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/views/EditSystemModal/EditSystemModal', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/utils/scores', () => ({
  __esModule: true,
  useDatacallAggregates: () => ({
    scoresPerCall: [mockScoreRows],
    isPending: false,
    isError: mockScoresError,
  }),
  useDatacallProgress: () => ({
    progressPerCall: [
      [
        {
          fismasystemid: 1,
          questionsexpected: 10,
          questionsanswered: 10,
          questionsupdated: 10,
          lastupdatedat: null,
          updatedsincestart: true,
        },
        {
          fismasystemid: 2,
          questionsexpected: 10,
          questionsanswered: 0,
          questionsupdated: 0,
          lastupdatedat: null,
          updatedsincestart: false,
        },
      ],
    ],
    isPending: false,
    isError: false,
  }),
  usePillarAggregates: () => ({ data: [], isPending: false }),
  useScoreHistory: () => ({
    data: mockHistory,
    isPending: false,
    isError: false,
  }),
}))

jest.mock('@/utils/opdivs', () => ({
  ...jest.requireActual('@/utils/opdivs'),
  useUpdateOpDiv: () => ({ mutateAsync: mockUpdate, isPending: false }),
}))
jest.mock('@/utils/delegates', () => ({
  ...jest.requireActual('@/utils/delegates'),
  useSetOpDivDelegateEnabled: () => ({
    mutateAsync: mockDelegate,
    isPending: false,
  }),
}))
jest.mock('@/utils/notify', () => ({
  ...jest.requireActual('@/utils/notify'),
  notify: (...args: unknown[]) => mockNotify(...args),
}))

const mockExport = jest.fn().mockResolvedValue(undefined)
jest.mock('@/utils/exportSystems', () => ({
  ...jest.requireActual('@/utils/exportSystems'),
  exportSystemAnswers: (...args: unknown[]) => mockExport(...args),
}))

jest.mock('@/utils/users', () => ({
  __esModule: true,
  useUsers: () => ({
    data: mockUsersError ? undefined : mockUsers,
    isPending: false,
    isError: mockUsersError,
  }),
}))

import OpDivDashboard from './OpDivDashboard'
import OpDivIndexRedirect from './OpDivIndexRedirect'
import { NOT_STARTED_PANEL_ID } from '@/components/ScoreSummary/SummaryKpiRow'

const makeSystem = (
  id: number,
  overrides: Partial<FismaSystemType> = {}
): FismaSystemType =>
  ({
    fismasystemid: id,
    fismauid: `uid-${id}`,
    fismaacronym: `SYS${id}`,
    fismaname: `System ${id}`,
    fismasubsystem: '',
    component: '',
    mission: '',
    fismaimpactlevel: '',
    issoemail: `isso${id}@example.gov`,
    sdl_sync_enabled: true,
    datacenterenvironment: 'AWS',
    datacallcontact: `poc${id}@example.gov`,
    decommissioned: false,
    decommissioned_date: null,
    decommissioned_by: null,
    decommissioned_notes: null,
    reactivated_by: null,
    reactivated_date: null,
    reactivation_notes: null,
    opdiv_id: 7,
    ...overrides,
  }) as FismaSystemType

const makeUser = (role: UserRole): userData => ({
  userid: 'u1',
  email: 'a@example.gov',
  fullname: 'A User',
  role,
  assignedopdivids: [7],
})

beforeEach(() => {
  mockOpDivId = '7'
  mockContext = {}
  mockScoresError = false
  mockUsersError = false
  mockUser = makeUser('OWNER')
  mockSystems = [
    makeSystem(1, { hva: true, fips: 'High' }),
    makeSystem(2, { hva: null, fips: null }),
  ]
  mockScoreRows = [
    {
      datacallid: 104,
      fismasystemid: 1,
      systemscore: 4.2,
      systemtier: 'Optimal',
    },
    {
      datacallid: 104,
      fismasystemid: 2,
      systemscore: 2.6,
      systemtier: 'Initial',
    },
  ]
  mockUsers = [
    {
      userid: 'u-admin',
      email: 'ada@example.gov',
      fullname: 'Ada Admin',
      role: 'OPDIV_ADMIN',
      assignedopdivids: [7],
    },
    {
      userid: 'u-isso',
      email: 'ira@example.gov',
      fullname: 'Ira Isso',
      role: 'ISSO',
      assignedopdivids: [7],
    },
  ] as userData[]
  mockHistory = []
  mockCalls.length = 0
  mockUpdate.mockReset().mockImplementation(async () => {
    mockCalls.push('identity')
  })
  mockDelegate.mockReset().mockImplementation(async () => {
    mockCalls.push('delegate')
  })
  mockNotify.mockReset()
  mockSetShowDecommissioned.mockClear()
  mockExport.mockClear()
})

const Landed = () => <p>landed on {useLocation().pathname}</p>

describe('OpDivDashboard', () => {
  it('names the OpDiv and renders its computed score', () => {
    renderWithProviders(<OpDivDashboard />)

    expect(
      screen.getByText('National Institutes of Health')
    ).toBeInTheDocument()
    // (4.2 + 2.6) / 2 = 3.40, averaged over scored systems. The value also
    // appears as the median footer, so the denominator line is what pins the
    // hero specifically.
    expect(screen.getAllByText('3.40').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Average of 2 scored systems of 2')
    ).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('states the median and range beside the score-by-system bars', () => {
    // A tail of systems at the 1.00 floor drags the mean somewhere no real
    // system sits, so the median is what tells you the set is split.
    renderWithProviders(<OpDivDashboard />)

    const footer = screen.getByText(/median/i)
    expect(footer).toHaveTextContent('3.40')
    expect(footer).toHaveTextContent('2.60')
    expect(footer).toHaveTextContent('4.20')
  })

  it('names the OpDiv administrators rather than only counting them', () => {
    // "Owner 8" answers nothing anyone needs; the panel exists to say who to
    // ask, so it lists people with their role.
    renderWithProviders(<OpDivDashboard />)

    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('ada@example.gov')).toBeInTheDocument()
    expect(screen.getByText('OpDiv Admin')).toBeInTheDocument()
    // ISSOs hold OpDiv grants that are not their scope, so they are not listed
    // here - counting them would overstate who covers the OpDiv.
    expect(screen.queryByText('Ira Isso')).not.toBeInTheDocument()
  })

  it('reports unknown metadata as unknown rather than as a negative', () => {
    renderWithProviders(<OpDivDashboard />)

    // System 2 records neither flag. That must be stated rather than folded
    // into the negative: counting it as "not an HVA" asserts something nobody
    // has recorded, and quietly shrinks the risk denominator.
    expect(
      screen.getByText(/1 system has no HVA or FIPS designation recorded/)
    ).toBeInTheDocument()
  })

  it('leads with what needs doing rather than with the inventory', () => {
    // The top row is a severity ranking: the outstanding questionnaire is a
    // tile, while the standing counts are one muted line beneath it.
    renderWithProviders(<OpDivDashboard />)

    // A button, not a plain tile: it jumps to the panel naming the system to
    // chase, which is the whole point of promoting it.
    // Anchored, so the panel's own "About Not started" info button does not
    // also match.
    const notStarted = screen.getByRole('button', { name: /^Not started/ })
    expect(notStarted).toHaveTextContent('1/2')
    // The standing counts moved down a row; they are tiles, not fine print.
    // The label sits in its own row inside the tile, so step out to the tile.
    const systems = screen.getByText('Systems').closest('div')
      ?.parentElement as HTMLElement
    expect(systems).toHaveTextContent('2 in this call')
  })

  it('offers an OWNER every header action', () => {
    renderWithProviders(<OpDivDashboard />)

    expect(
      screen.getByRole('button', { name: /^export$/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /settings/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add system/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /manage opdivs/i })
    ).toBeInTheDocument()
  })

  it('withholds every write action from a read-only admin', () => {
    // These map to endpoints that would 403 this tier, so offering them at all
    // would be an invitation to an error.
    mockUser = makeUser('OPDIV_READONLY_ADMIN')
    renderWithProviders(<OpDivDashboard />)

    expect(
      screen.getByRole('button', { name: /^export$/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /settings/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /add system/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /manage opdivs/i })
    ).not.toBeInTheDocument()
  })

  it('withholds the OpDiv-wide management grid from an OpDiv-scoped admin', () => {
    mockUser = makeUser('OPDIV_ADMIN')
    renderWithProviders(<OpDivDashboard />)

    expect(
      screen.getByRole('button', { name: /add system/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /manage opdivs/i })
    ).not.toBeInTheDocument()
  })

  it('bounds the score-by-system panel for a large OpDiv', () => {
    // Unbounded, this panel grew a bar per system and stretched its grid row
    // into a mostly-empty column. It now shows both ends and names the middle.
    const count = 40
    mockSystems = Array.from({ length: count }, (_, i) => makeSystem(i + 1))
    mockScoreRows = Array.from({ length: count }, (_, i) => ({
      datacallid: 104,
      fismasystemid: i + 1,
      systemscore: 5 - i * 0.1,
      systemtier: 'Advanced',
    }))

    renderWithProviders(<OpDivDashboard />)

    // Both ends survive (each also appears in a highest/lowest KPI tile, hence
    // getAllByText), and the middle is summarized rather than cut off silently.
    expect(screen.getAllByText('SYS1').length).toBeGreaterThan(0)
    expect(screen.getAllByText(`SYS${count}`).length).toBeGreaterThan(0)
    const hidden = count - EXTREMES_PER_END * 2
    expect(
      screen.getByText(new RegExp(`${hidden} more systems in between`, 'i'))
    ).toBeInTheDocument()
    // A mid-ranked system appears nowhere on the page - it is neither an
    // extreme nor a KPI, so its absence is proof the middle was dropped.
    expect(screen.queryByText('SYS20')).not.toBeInTheDocument()
  })

  it('aggregates every visible OpDiv at /opdivs/all', () => {
    mockOpDivId = 'all'
    // Systems from two different OpDivs, plus one owned by the HHS parent row
    // which is not a switchable tenant - the aggregate still counts it, since
    // /fismasystems is already narrowed to what this caller may see.
    mockSystems = [
      makeSystem(1, { opdiv_id: 7 }),
      makeSystem(2, { opdiv_id: 9 }),
      makeSystem(3, { opdiv_id: 1 }),
    ]
    mockScoreRows = [1, 2, 3].map((id) => ({
      datacallid: 104,
      fismasystemid: id,
      systemscore: 3,
      systemtier: 'Advanced',
    }))

    renderWithProviders(<OpDivDashboard />)

    expect(screen.getByText('All OpDivs')).toBeInTheDocument()
    const systems = screen.getByText('Systems').closest('div')
      ?.parentElement as HTMLElement
    expect(systems).toHaveTextContent('3')
  })

  it('withholds the per-OpDiv settings action in the aggregate', () => {
    // Settings edits ONE OpDiv's record, so it has nothing to act on here.
    mockOpDivId = 'all'
    renderWithProviders(<OpDivDashboard />)

    expect(
      screen.queryByRole('button', { name: /settings/i })
    ).not.toBeInTheDocument()
    // Actions that do make sense across OpDivs stay.
    expect(
      screen.getByRole('button', { name: /^export$/i })
    ).toBeInTheDocument()
  })

  it('offers no aggregate to a caller with a single OpDiv', () => {
    // The aggregate would be that one OpDiv, so /opdivs/all is not a page.
    mockOpDivId = 'all'
    mockUser = { ...makeUser('OPDIV_ADMIN'), assignedopdivids: [7] }
    renderWithProviders(<OpDivDashboard />)

    expect(screen.getByText('OpDiv not found')).toBeInTheDocument()
  })

  it('explains an OpDiv the caller is not assigned to', () => {
    mockUser = { ...makeUser('OPDIV_ADMIN'), assignedopdivids: [99] }
    renderWithProviders(<OpDivDashboard />)

    expect(screen.getByText('No access to this OpDiv')).toBeInTheDocument()
    // The explanation REPLACES the dashboard - a zeroed-out summary alongside
    // it would read as "this OpDiv has no systems".
    expect(screen.queryByText('Overall ZT score')).not.toBeInTheDocument()
  })

  describe('load failures', () => {
    // Each of these used to render as a fact: "no OpDivs", "not found", an
    // all-zero dashboard, an empty roster, or an endless spinner.
    it('reports a failed /opdivs rather than "not found"', () => {
      mockContext = { opdivs: [], opdivsError: true }
      renderWithProviders(<OpDivDashboard />)
      expect(screen.getByText('Could not load OpDivs')).toBeInTheDocument()
      expect(screen.queryByText('OpDiv not found')).not.toBeInTheDocument()
    })

    it('reports a failed systems load rather than an all-zero dashboard', () => {
      mockContext = { fismaSystems: [], fismaSystemsError: true }
      renderWithProviders(<OpDivDashboard />)
      expect(screen.getByText('Could not load systems')).toBeInTheDocument()
      expect(screen.queryByText('Overall ZT score')).not.toBeInTheDocument()
    })

    it('reports a failed /datacalls rather than spinning forever', () => {
      mockContext = { activeDatacallIds: [], datacallsError: true }
      renderWithProviders(<OpDivDashboard />)
      expect(screen.getByText('Could not load data calls')).toBeInTheDocument()
    })

    it('reports failed scores', () => {
      mockScoresError = true
      renderWithProviders(<OpDivDashboard />)
      expect(screen.getByText('Could not load scores')).toBeInTheDocument()
    })

    it('does not call a failed users load an empty roster', () => {
      mockUsersError = true
      renderWithProviders(<OpDivDashboard />)
      expect(screen.getByText(/Could not load users/)).toBeInTheDocument()
      expect(
        screen.queryByText(/No admin-tier users are assigned/)
      ).not.toBeInTheDocument()
    })
  })

  it('holds the skeleton while the decommissioned list is swapped out', () => {
    mockContext = { showDecommissioned: true }
    renderWithProviders(<OpDivDashboard />)
    expect(mockSetShowDecommissioned).toHaveBeenCalledWith(false)
    expect(screen.getByLabelText('Loading OpDiv')).toBeInTheDocument()
    expect(screen.queryByText('Overall ZT score')).not.toBeInTheDocument()
  })

  it('keeps holding until the active list replaces the decommissioned one', () => {
    const decommissioned = [makeSystem(1, { decommissioned: true })]
    mockContext = { showDecommissioned: true, fismaSystems: decommissioned }
    const { rerender } = renderWithProviders(<OpDivDashboard />)

    // Flag cleared, refetch still in flight: the stale list is still in place.
    mockContext = { showDecommissioned: false, fismaSystems: decommissioned }
    rerender(<OpDivDashboard />)
    expect(screen.getByLabelText('Loading OpDiv')).toBeInTheDocument()

    mockContext = { showDecommissioned: false }
    rerender(<OpDivDashboard />)
    expect(screen.queryByLabelText('Loading OpDiv')).not.toBeInTheDocument()
    expect(screen.getAllByText('3.40').length).toBeGreaterThan(0)
  })

  it('keeps the switcher out of the h1', () => {
    renderWithProviders(<OpDivDashboard />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('National Institutes of Health')
    expect(within(h1).queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Switch OpDiv' })
    ).toBeInTheDocument()
  })

  it('shows an inactive OpDiv opened by URL as the current selection', () => {
    mockContext = {
      opdivs: [{ ...OPDIV, active: false }, OTHER_OPDIV],
    }
    renderWithProviders(<OpDivDashboard />)
    expect(screen.getByRole('combobox', { name: 'Switch OpDiv' })).toHaveValue(
      'NIH'
    )
  })

  it('offers no Add system on an inactive OpDiv', () => {
    // The create form only lists active OpDivs, so the prefill would be blank.
    mockContext = { opdivs: [{ ...OPDIV, active: false }, OTHER_OPDIV] }
    renderWithProviders(<OpDivDashboard />)
    expect(
      screen.queryByRole('button', { name: /add system/i })
    ).not.toBeInTheDocument()
  })

  it('labels the users link for what a read-only admin can do there', () => {
    mockUser = makeUser('OPDIV_READONLY_ADMIN')
    renderWithProviders(<OpDivDashboard />)
    expect(
      screen.getByRole('link', { name: /view users/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /manage users/i })
    ).not.toBeInTheDocument()
  })

  it('links not-started systems to the id-keyed questionnaire route', () => {
    renderWithProviders(<OpDivDashboard />)
    expect(screen.getByRole('link', { name: 'SYS2' })).toHaveAttribute(
      'href',
      '/questionnaire/system/2/FY26_ZTM'
    )
  })

  describe('export scope', () => {
    // Every id rides the query string, and CloudFront rejects URLs past ~8KB.
    it('sends no fsids in the aggregate, as the full export on Home does', async () => {
      mockOpDivId = 'all'
      renderWithProviders(<OpDivDashboard />)
      await userEvent.click(screen.getByRole('button', { name: /^export$/i }))
      expect(mockExport).toHaveBeenCalledWith(104, undefined)
    })

    it('sends no fsids when one OpDiv holds every system the caller has', async () => {
      renderWithProviders(<OpDivDashboard />)
      await userEvent.click(screen.getByRole('button', { name: /^export$/i }))
      expect(mockExport).toHaveBeenCalledWith(104, undefined)
    })

    it('names the systems when the OpDiv is a subset of the caller scope', async () => {
      mockSystems = [...mockSystems, makeSystem(3, { opdiv_id: 9 })]
      renderWithProviders(<OpDivDashboard />)
      await userEvent.click(screen.getByRole('button', { name: /^export$/i }))
      expect(mockExport).toHaveBeenCalledWith(104, [1, 2])
    })

    it('disables, rather than fails, a subset too large for one URL', () => {
      mockSystems = [
        ...Array.from({ length: 700 }, (_, i) => makeSystem(10000 + i)),
        makeSystem(3, { opdiv_id: 9 }),
      ]
      renderWithProviders(<OpDivDashboard />)
      expect(screen.getByRole('button', { name: /^export$/i })).toBeDisabled()
    })
  })

  describe('settings save', () => {
    const save = async () => {
      renderWithProviders(<OpDivDashboard />)
      await userEvent.click(screen.getByRole('button', { name: /settings/i }))
      await userEvent.click(screen.getByLabelText('System Delegate role'))
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    }

    it('saves identity before the delegate toggle', async () => {
      await save()
      await waitFor(() => expect(mockCalls).toEqual(['identity', 'delegate']))
    })

    it('says which part saved when only the toggle fails', async () => {
      mockDelegate.mockRejectedValue(new Error('boom'))
      await save()
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          expect.stringMatching(
            /^Saved code, name.*but not the System Delegate/
          ),
          'error'
        )
      )
    })
  })

  it('jumps from the Not started tile to its panel and focuses it', async () => {
    Element.prototype.scrollIntoView = jest.fn()
    renderWithProviders(<OpDivDashboard />)
    await userEvent.click(screen.getByRole('button', { name: /^Not started/ }))
    expect(document.activeElement).toBe(
      document.getElementById(NOT_STARTED_PANEL_ID)
    )
  })

  it('offers a text table of the trend', () => {
    const call = (datacallid: number, name: string, deadline: string) => ({
      datacallid,
      datacall: name,
      datecreated: '2024-10-01',
      deadline,
    })
    mockContext = {
      datacalls: [
        call(103, 'FY25 ZTM', '2025-09-11'),
        call(104, 'FY26 ZTM', '2026-09-11'),
      ],
    }
    mockHistory = [103, 104].flatMap((datacallid) =>
      [1, 2].map((fismasystemid) => ({
        datacallid,
        fismasystemid,
        systemscore: 3,
      }))
    )
    renderWithProviders(<OpDivDashboard />)
    const rows = within(
      screen.getByRole('table', { hidden: true })
    ).getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(3)
  })

  it('skips a just-deactivated OpDiv on the /opdivs redirect', () => {
    window.sessionStorage.setItem('ztmf.lastOpDivId', '7')
    mockUser = { ...makeUser('OPDIV_ADMIN'), assignedopdivids: [7, 9] }
    const { container } = renderWithProviders(
      <Routes>
        <Route path="/opdivs" element={<OpDivIndexRedirect />} />
        <Route path="/opdivs/:id" element={<Landed />} />
      </Routes>,
      { initialEntries: [{ pathname: '/opdivs', state: { skipOpDivId: 7 } }] }
    )
    expect(container).toHaveTextContent('landed on /opdivs/9')
  })
})
