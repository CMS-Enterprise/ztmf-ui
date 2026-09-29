/**
 * Integration smoke test for the assembled dashboard.
 *
 * The pure modules are pinned separately; what this covers is the wiring -
 * that the page composes without crashing, shows real figures rather than
 * placeholders, and offers each header action only to the tier the backend
 * would accept it from.
 */
import { screen } from '@testing-library/react'
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

jest.mock('@/api/scores', () => ({
  __esModule: true,
  useDatacallAggregates: () => ({
    scoresPerCall: [mockScoreRows],
    isPending: false,
    isError: false,
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
  useScoreHistory: () => ({ data: [], isPending: false, isError: false }),
}))

jest.mock('@/api/users', () => ({
  __esModule: true,
  useUsers: () => ({ data: mockUsers, isPending: false }),
}))

import OpDivDashboard from './OpDivDashboard'

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
  mockSetShowDecommissioned.mockClear()
})

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
})
