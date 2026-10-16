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
jest.mock('../StatisticBlocks/StatisticsBlocks', () => () => null)
jest.mock(
  '@/components/DatacallContextCard/DatacallContextCard',
  () => () => null
)

let modalProps: Record<string, unknown> = {}
jest.mock('../EditSystemModal/EditSystemModal', () => (props: object) => {
  modalProps = props as Record<string, unknown>
  return null
})

import { screen, waitFor } from '@testing-library/react'
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
    // An empty selection before the calls land is not an answer, so the
    // dashboard waits on this rather than on the id list being non-empty.
    datacallsLoaded: true,
    activeDatacallIds: [5],
    fismaSystems: [],
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

// On a cold load the data calls have not arrived, so the selection is empty
// and no scores are asked for. Rendering then showed every system unscored
// for a moment, then the spinner once the ids landed, then the real numbers.
test('waits for the data calls instead of rendering an unscored table', async () => {
  mockCtx.datacallsLoaded = false
  mockCtx.datacalls = []
  mockCtx.activeDatacallIds = []

  renderWithProviders(<Home />)

  expect(await screen.findByRole('progressbar')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Add system' })
  ).not.toBeInTheDocument()
})

test('the trend read shares the fan-out key, so the prior call is fetched once', async () => {
  // Two calls active, and the prior call for the trend is the second of them.
  // The dashboard asks for call 4's aggregate twice over: once in the fan-out
  // and once for the trend. They share a query key, so one request goes out.
  mockCtx.datacalls = [
    {
      datacallid: 5,
      datacall: 'FY26 ZTM',
      datecreated: '2025-10-01T00:00:00Z',
      deadline: '2099-12-31T23:59:59Z',
    },
    {
      datacallid: 4,
      datacall: 'FY25 ZTM',
      datecreated: '2024-10-01T00:00:00Z',
      deadline: '2025-12-31T23:59:59Z',
    },
  ]
  mockCtx.activeDatacallIds = [5, 4]

  renderWithProviders(<Home />)
  await screen.findByRole('button', { name: 'Add system' })

  const aggregateCalls = () =>
    (axiosInstance.get as jest.Mock).mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes('/scores/aggregate'))
  await waitFor(() => expect(aggregateCalls().length).toBeGreaterThan(0))

  expect(aggregateCalls().filter((url) => url.includes('=4'))).toHaveLength(1)
})
