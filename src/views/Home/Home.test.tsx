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

// The table is out of scope here; the stub records the filter Home hands it.
let tableProps: Record<string, unknown> = {}
jest.mock('../FismaTable/FismaTable', () => (props: object) => {
  tableProps = props as Record<string, unknown>
  return null
})
jest.mock(
  '@/components/DatacallContextCard/DatacallContextCard',
  () => () => null
)

// The real band over stubbed data, so its tiles drive Home's table filter.
let mockBandData: Record<string, unknown>
jest.mock('../MySystems/useMySystemsData', () => ({
  useMySystemsData: () => mockBandData,
}))
jest.mock('@/components/ScoreSummary/ScoreHero', () => () => null)

let modalProps: Record<string, unknown> = {}
jest.mock('../EditSystemModal/EditSystemModal', () => (props: object) => {
  modalProps = props as Record<string, unknown>
  return null
})

import { act, screen, waitFor } from '@testing-library/react'
import { queryKeys } from '@/api/keys'
import userEvent from '@testing-library/user-event'
import Home from './Home'
import { actionableBandData } from '../MySystems/testFixtures'
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
  tableProps = {}
  mockBandData = actionableBandData()
  window.localStorage.clear()
  Element.prototype.scrollIntoView = jest.fn()
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

// The modal returns the record it posted, but the server derives fields on
// write, so the row the dashboard shows has to come from a refetch rather
// than from the modal's copy.
test('creating a system refreshes the list instead of splicing in the record', async () => {
  const { queryClient } = renderWithProviders(<Home />)
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
  await screen.findByRole('button', { name: 'Add system' })

  act(() => {
    ;(modalProps.onClose as (s: unknown) => void)({
      fismasystemid: 99,
      fismaname: 'Death Star',
      fismaacronym: 'DS',
    })
  })

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.fismaSystems.lists(),
  })
})

describe('the summary band tiles', () => {
  const table = () =>
    document.getElementById('dashboard-systems-table') as HTMLElement

  it.each(['Not started', 'Answers to confirm'])(
    '%s filters the table to not-updated systems and lands on it',
    async (label) => {
      const user = userEvent.setup()
      renderWithProviders(<Home />)
      expect(await screen.findByText('At a glance')).toBeVisible()
      expect(tableProps.notUpdatedOnly).toBe(false)

      await user.click(
        screen.getByRole('button', { name: new RegExp(`^${label}`) })
      )

      expect(tableProps.notUpdatedOnly).toBe(true)
      expect(table().scrollIntoView).toHaveBeenCalled()
      expect(table()).toHaveFocus()
      expect(table().style.boxShadow).not.toBe('')
    }
  )

  it("follows the table's own changes to the filter", async () => {
    // Clear filters and the historical-year reset both go through this callback.
    const user = userEvent.setup()
    renderWithProviders(<Home />)
    await user.click(
      await screen.findByRole('button', { name: /^Not started/ })
    )
    expect(tableProps.notUpdatedOnly).toBe(true)

    act(() => {
      ;(tableProps.onNotUpdatedOnlyChange as (v: boolean) => void)(false)
    })

    expect(tableProps.notUpdatedOnly).toBe(false)
  })

  it('keeps the filter on across a year switch that keeps the open call in view', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(<Home />)
    await user.click(
      await screen.findByRole('button', { name: /^Not started/ })
    )
    expect(tableProps.notUpdatedOnly).toBe(true)

    // Adding a closed call means new score queries. The calls already in view
    // have answered, so the table stays mounted while those load rather than
    // being replaced by the page spinner.
    mockCtx = {
      ...mockCtx,
      activeDatacallIds: [5, 4],
      datacalls: [
        ...(mockCtx.datacalls as object[]),
        {
          datacallid: 4,
          datacall: 'FY25 ZTM',
          datecreated: '2024-10-01T00:00:00Z',
          deadline: '2025-06-30T23:59:59Z',
        },
      ],
    }
    tableProps = {}
    rerender(<Home />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

    await waitFor(() => expect(tableProps.notUpdatedOnly).toBe(true))
  })

  it('leaves the tiles plain when the open call is not in view', async () => {
    // A historical year is selected while call 5 is open: the table's
    // "Not updated only" switch is disabled there, so the tiles cannot use it.
    mockCtx.activeDatacallIds = [4]
    renderWithProviders(<Home />)

    expect(await screen.findByText('Not started')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Not started/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Answers to confirm/ })
    ).not.toBeInTheDocument()
  })
})
