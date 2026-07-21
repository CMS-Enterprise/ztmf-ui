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
  onFiltersChange = jest.fn()
) {
  return render(
    <QuickSearchToolbar filters={filters} onFiltersChange={onFiltersChange} />
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
