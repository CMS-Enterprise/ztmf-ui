import { render, screen, fireEvent } from '@testing-library/react'
import { QuickSearchToolbar } from './FismaTable'
import {
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from './dashboardFilters'

// FismaTable's module graph reaches @/axiosConfig, which reads import.meta.env;
// stub it so Jest can parse the graph (mirrors FismaTable.test.tsx).
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

// GridToolbarQuickFilter — and now the toolbar itself (#573) — call grid hooks
// that need a mounted DataGrid. This test renders the toolbar bare, so stub the
// quick-filter node and the grid API/selector hooks. mockQuickFilterValues is
// controllable per test to drive the "quick filter is active" state.
const mockSetQuickFilterValues = jest.fn()
let mockQuickFilterValues: string[] = []
jest.mock('@mui/x-data-grid', () => ({
  ...jest.requireActual('@mui/x-data-grid'),
  GridToolbarQuickFilter: () => <div data-testid="quick-filter" />,
  useGridApiContext: () => ({
    current: { setQuickFilterValues: mockSetQuickFilterValues },
  }),
  useGridSelector: () => mockQuickFilterValues,
  gridQuickFilterValuesSelector: jest.fn(),
}))

// The toolbar reads Show Decommissioned from the Title outlet context (it gates
// a refetch, so it lives there, not in the client-side filter model). Mock the
// context hook so we can drive that flag per test.
const mockSetShowDecommissioned = jest.fn()
let mockShowDecommissioned = false
jest.mock('@/views/Title/Context', () => ({
  __esModule: true,
  useContextProp: () => ({
    showDecommissioned: mockShowDecommissioned,
    setShowDecommissioned: mockSetShowDecommissioned,
  }),
}))

function renderToolbar(
  filters: DashboardFilterState = EMPTY_DASHBOARD_FILTERS,
  onFiltersChange = jest.fn(),
  { hasOpenCall = true, openCallInView = true } = {}
) {
  return render(
    <QuickSearchToolbar
      filters={filters}
      onFiltersChange={onFiltersChange}
      hasOpenCall={hasOpenCall}
      openCallInView={openCallInView}
    />
  )
}

const clearBtn = () => screen.getByRole('button', { name: /clear filters/i })

beforeEach(() => {
  jest.clearAllMocks()
  mockShowDecommissioned = false
  mockQuickFilterValues = []
})

describe('QuickSearchToolbar — Clear filters vs Show Decommissioned (#566)', () => {
  it('disables Clear filters when nothing is active', () => {
    renderToolbar()
    expect(clearBtn()).toBeDisabled()
  })

  it('enables Clear filters when only Show Decommissioned is on', () => {
    // The bug: this toggle lives outside the filter model, so the button used to
    // stay greyed out even though a filter was effectively active.
    mockShowDecommissioned = true
    renderToolbar()
    expect(clearBtn()).toBeEnabled()
  })

  it('still enables Clear filters for a normal filter (no regression)', () => {
    renderToolbar({ ...EMPTY_DASHBOARD_FILTERS, notUpdatedOnly: true })
    expect(clearBtn()).toBeEnabled()
  })

  it('Clear filters resets both the filter model and Show Decommissioned', () => {
    mockShowDecommissioned = true
    const onFiltersChange = jest.fn()
    renderToolbar(
      { ...EMPTY_DASHBOARD_FILTERS, notUpdatedOnly: true },
      onFiltersChange
    )
    fireEvent.click(clearBtn())
    expect(onFiltersChange).toHaveBeenCalledWith(EMPTY_DASHBOARD_FILTERS)
    expect(mockSetShowDecommissioned).toHaveBeenCalledWith(false)
  })

  it('flipping the Show Decommissioned switch drives the context setter', () => {
    renderToolbar()
    const toggle = screen.getByRole('checkbox', {
      name: /show decommissioned/i,
    })
    fireEvent.click(toggle)
    expect(mockSetShowDecommissioned).toHaveBeenCalledWith(true)
  })
})

describe('QuickSearchToolbar — call-scoped toggles (#639)', () => {
  const openCallToggle = () =>
    screen.getByRole('checkbox', { name: /open data call only/i })
  const notUpdatedToggle = () =>
    screen.getByRole('checkbox', { name: /not updated only/i })

  it('flipping Open data call only drives the filter model', () => {
    const onFiltersChange = jest.fn()
    renderToolbar(EMPTY_DASHBOARD_FILTERS, onFiltersChange)
    fireEvent.click(openCallToggle())
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...EMPTY_DASHBOARD_FILTERS,
      openCallOnly: true,
    })
  })

  it('enables Clear filters when only Open data call only is on', () => {
    renderToolbar({ ...EMPTY_DASHBOARD_FILTERS, openCallOnly: true })
    expect(clearBtn()).toBeEnabled()
  })

  it('disables both call-scoped toggles when no call is open', () => {
    // The bug: "Not updated only" stayed live on a closed call and silently
    // emptied the grid. Both call-scoped toggles gray out instead;
    // Show Decommissioned is not call-scoped and stays live.
    renderToolbar(EMPTY_DASHBOARD_FILTERS, jest.fn(), {
      hasOpenCall: false,
      openCallInView: false,
    })
    expect(openCallToggle()).toBeDisabled()
    expect(notUpdatedToggle()).toBeDisabled()
    expect(
      screen.getByRole('checkbox', { name: /show decommissioned/i })
    ).toBeEnabled()
  })

  it('shows the no-open-call caption only when no call is open', () => {
    renderToolbar(EMPTY_DASHBOARD_FILTERS, jest.fn(), {
      hasOpenCall: false,
      openCallInView: false,
    })
    expect(screen.getByText(/no open data call/i)).toBeInTheDocument()
  })

  it('disables the toggles with the out-of-view caption on a historical year', () => {
    // A call can be open while the year picker shows a historical group; no
    // viewed row is current, so the toggles gray out with wording that does
    // not falsely claim nothing is open.
    renderToolbar(EMPTY_DASHBOARD_FILTERS, jest.fn(), {
      hasOpenCall: true,
      openCallInView: false,
    })
    expect(openCallToggle()).toBeDisabled()
    expect(notUpdatedToggle()).toBeDisabled()
    expect(
      screen.getByText(/open data call is not in the selected view/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/no open data call/i)).not.toBeInTheDocument()
  })

  it('keeps the toggles live and the caption hidden while a call is open', () => {
    renderToolbar()
    expect(screen.queryByText(/no open data call/i)).not.toBeInTheDocument()
    expect(openCallToggle()).toBeEnabled()
    expect(notUpdatedToggle()).toBeEnabled()
  })
})

describe('QuickSearchToolbar — Clear filters vs quick-filter (#573)', () => {
  it('enables Clear filters when only the quick-filter is active', () => {
    // The quick-filter lives in the grid's own model, not DashboardFilterState;
    // without counting it, Clear stayed greyed out and couldn't clear the term.
    mockQuickFilterValues = ['star destroyer']
    renderToolbar()
    expect(clearBtn()).toBeEnabled()
  })

  it('keeps Clear filters disabled when the quick-filter is empty and nothing else is active', () => {
    mockQuickFilterValues = []
    renderToolbar()
    expect(clearBtn()).toBeDisabled()
  })

  it('Clear filters resets the grid quick-filter alongside the other facets', () => {
    mockQuickFilterValues = ['star destroyer']
    const onFiltersChange = jest.fn()
    renderToolbar(EMPTY_DASHBOARD_FILTERS, onFiltersChange)
    fireEvent.click(clearBtn())
    expect(mockSetQuickFilterValues).toHaveBeenCalledWith([])
    expect(onFiltersChange).toHaveBeenCalledWith(EMPTY_DASHBOARD_FILTERS)
  })
})
