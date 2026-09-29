// The dashboard's Add system button opens its own EditSystemModal. The
// modal's owning-OpDiv selector is required and draws its options from the
// `opdivs` prop, so the dashboard must pass the shared OpDiv list through.

// axiosConfig reads import.meta.env at module load and throws under @swc/jest.
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

let mockCtx: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

// The dashboard body is out of scope here; stub it so the test only renders
// the header and the Add modal wiring.
jest.mock('../FismaTable/FismaTable', () => () => null)
jest.mock('../StatisticBlocks/StatisticsBlocks', () => {
  const StatsStub = () => <div data-testid="stat-blocks" />
  return StatsStub
})
jest.mock(
  '@/components/DatacallContextCard/DatacallContextCard',
  () => () => null
)

// The band's own suite covers its behavior; here it only has to be
// distinguishable from StatisticsBlocks so the tier selection is observable.
let bandProps: Record<string, unknown> = {}
jest.mock('../MySystems/MySystemsBand', () => {
  const BandStub = (props: object) => {
    bandProps = props as Record<string, unknown>
    return <div data-testid="my-systems-band" />
  }
  return BandStub
})

let modalProps: Record<string, unknown> = {}
jest.mock('../EditSystemModal/EditSystemModal', () => (props: object) => {
  modalProps = props as Record<string, unknown>
  return null
})

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from './Home'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import axiosInstance from '@/axiosConfig'
import type { OpDiv, userData } from '@/types'

const OPDIVS: OpDiv[] = [
  {
    opdiv_id: 15,
    code: 'EMPIRE',
    name: 'Galactic Empire',
    is_parent: false,
    active: true,
    system_delegate_enabled: true,
  },
  {
    opdiv_id: 18,
    code: 'SEP',
    name: 'Separatist Alliance',
    is_parent: false,
    active: false,
    system_delegate_enabled: false,
  },
]

beforeEach(() => {
  // Empty score and progress responses are enough for the dashboard to leave
  // its loading state and render the header.
  ;(axiosInstance.get as jest.Mock).mockResolvedValue({ data: { data: [] } })
  modalProps = {}
  bandProps = {}
  mockCtx = {
    // One active call: the dashboard holds its spinner until the scores for
    // the active calls have loaded.
    latestDataCallId: 5,
    selectedDatacall: null,
    datacalls: [
      {
        datacallid: 5,
        datacall: 'FY26 ZTM',
        datecreated: '2025-10-01T00:00:00Z',
        deadline: '2099-12-31T23:59:59Z',
      },
    ],
    activeDatacallIds: [5],
    fismaSystems: [],
    setFismaSystems: jest.fn(),
    userInfo: {
      userid: '1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role: 'OWNER',
    } as userData,
    datacenterEnvironments: [],
    opdivs: OPDIVS,
  }
})

test('the Add system modal receives the shared OpDiv list', async () => {
  const user = userEvent.setup()
  renderWithProviders(<Home />)

  await user.click(await screen.findByRole('button', { name: 'Add system' }))

  expect(modalProps.open).toBe(true)
  expect(modalProps.mode).toBe('create')
  // The full list, inactive included: the modal filters to active itself.
  expect(modalProps.opdivs).toEqual(OPDIVS)
})

describe('summary selection by tier', () => {
  // The estate-wide tiles describe a population; the band describes a
  // worklist. Which one a user gets is the whole of this feature.
  const adminTiers = [
    'OWNER',
    'HHS_ADMIN',
    'OPDIV_ADMIN',
    'OPDIV_READONLY_ADMIN',
  ]
  it.each(adminTiers)('keeps the stat tiles for %s', async (role) => {
    mockCtx.userInfo = { ...(mockCtx.userInfo as object), role } as userData
    renderWithProviders(<Home />)

    expect(await screen.findByTestId('stat-blocks')).toBeInTheDocument()
    expect(screen.queryByTestId('my-systems-band')).not.toBeInTheDocument()
  })

  const scopedTiers = ['ISSO', 'ISSM']
  it.each(scopedTiers)('gives %s the systems band', async (role) => {
    mockCtx.userInfo = { ...(mockCtx.userInfo as object), role } as userData
    renderWithProviders(<Home />)

    expect(await screen.findByTestId('my-systems-band')).toBeInTheDocument()
    expect(screen.queryByTestId('stat-blocks')).not.toBeInTheDocument()
  })

  it('withholds the target worklist from a System Delegate', async () => {
    // A delegate is answers-only and cannot set a target maturity, so
    // offering them that backlog would be offering a 403.
    mockCtx.userInfo = {
      ...(mockCtx.userInfo as object),
      role: 'SYSTEM_DELEGATE',
    } as userData
    renderWithProviders(<Home />)

    expect(await screen.findByTestId('my-systems-band')).toBeInTheDocument()
    expect(bandProps.hideTargets).toBe(true)
  })

  it('gives an ISSO the full band including targets', async () => {
    mockCtx.userInfo = {
      ...(mockCtx.userInfo as object),
      role: 'ISSO',
    } as userData
    renderWithProviders(<Home />)

    await screen.findByTestId('my-systems-band')
    expect(bandProps.hideTargets).toBe(false)
  })
})
