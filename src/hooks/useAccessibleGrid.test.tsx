import { render, screen, waitFor } from '@testing-library/react'
import { DataGrid } from '@mui/x-data-grid'
import useAccessibleGrid from '@/hooks/useAccessibleGrid'

// Stands in for the ariaV7 grid DOM: a generic root holding the toolbar, main,
// and the footer, with the caller's aria-label forwarded to the root.
function GridHarness({
  label = 'Users',
  labelAttribute = 'aria-label',
  withMain = true,
  ensureScrollableContentFocusable = false,
}: {
  label?: string
  labelAttribute?: string
  withMain?: boolean
  ensureScrollableContentFocusable?: boolean
}) {
  const { ref } = useAccessibleGrid({ ensureScrollableContentFocusable })
  return (
    <div
      ref={ref}
      data-testid="root"
      className="MuiDataGrid-root"
      {...{ [labelAttribute]: label }}
    >
      <div className="MuiDataGrid-toolbarContainer">
        <input aria-label="Search" />
      </div>
      {withMain && (
        <div data-testid="main" className="MuiDataGrid-main" role="grid">
          <div
            data-testid="virtual-scroller"
            className="MuiDataGrid-virtualScroller"
          >
            <div role="rowgroup">
              <div data-testid="gridcell" role="gridcell" tabIndex={-1} />
            </div>
          </div>
        </div>
      )}
      <div className="MuiDataGrid-footerContainer" />
    </div>
  )
}

test('carries the accessible name onto the element that is the grid', async () => {
  render(<GridHarness />)

  await waitFor(() =>
    expect(screen.getByTestId('main')).toHaveAttribute('aria-label', 'Users')
  )
  // Prohibited on the generic root, and a second answer to what the grid is
  // called.
  expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label')
})

test('carries aria-labelledby the same way', async () => {
  render(<GridHarness labelAttribute="aria-labelledby" label="grid-heading" />)

  await waitFor(() =>
    expect(screen.getByTestId('main')).toHaveAttribute(
      'aria-labelledby',
      'grid-heading'
    )
  )
  expect(screen.getByTestId('root')).not.toHaveAttribute('aria-labelledby')
})

test('makes scrollable grid content keyboard-focusable when requested', async () => {
  render(<GridHarness ensureScrollableContentFocusable />)

  await waitFor(() =>
    expect(screen.getByTestId('gridcell')).toHaveAttribute('tabindex', '0')
  )
  expect(screen.getByTestId('virtual-scroller')).not.toHaveAttribute('tabindex')
})

test('leaves a grid without a main element untouched', async () => {
  // Every table test in this repo mocks the DataGrid away, and a rename of
  // MUI's internals would look the same: the hook has to be inert, never
  // stripping a name it cannot re-home.
  render(<GridHarness withMain={false} />)

  await waitFor(() => expect(screen.getByTestId('root')).toBeInTheDocument())
  expect(screen.getByTestId('root')).toHaveAttribute('aria-label', 'Users')
})

test('puts the grid role on main and names it, against the real DataGrid', async () => {
  // The end state this hook exists to produce. Against the real component
  // because the value is in MUI's ariaV7 wiring plus ours, not ours alone.
  function Grid() {
    const accessibleGrid = useAccessibleGrid({
      ensureScrollableContentFocusable: true,
    })
    return (
      <DataGrid
        {...accessibleGrid}
        aria-label="Users"
        rows={[{ id: 1, name: 'Piett' }]}
        columns={[{ field: 'name' }]}
        autoHeight
      />
    )
  }
  const { container } = render(<Grid />)

  const main = container.querySelector('.MuiDataGrid-main')
  await waitFor(() => expect(main).toHaveAttribute('aria-label', 'Users'))
  expect(main).toHaveAttribute('role', 'grid')
  expect(main).toHaveAttribute('aria-colcount', '1')
  await waitFor(() =>
    expect(
      container.querySelector('.MuiDataGrid-virtualScroller [role="gridcell"]')
    ).toHaveAttribute('tabindex', '0')
  )
  expect(
    container.querySelector('.MuiDataGrid-virtualScroller')
  ).not.toHaveAttribute('tabindex')

  // The toolbar and the pagination footer live out here, which is the whole
  // reason the grid role may not sit on the root.
  const root = container.querySelector('.MuiDataGrid-root')
  expect(root).not.toHaveAttribute('role')
  expect(root).not.toHaveAttribute('aria-label')

  // role="cell" is a table role; a grid takes gridcell.
  expect(container.querySelector('[role="cell"]')).toBeNull()
  expect(container.querySelector('[role="gridcell"]')).toBeInTheDocument()
})
