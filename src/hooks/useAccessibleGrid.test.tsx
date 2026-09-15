import { render, screen, waitFor } from '@testing-library/react'
import { DataGrid } from '@mui/x-data-grid'
import useAccessibleGrid from '@/hooks/useAccessibleGrid'

// Stands in for the MUI v6 grid DOM: the root carries role="grid" and the aria
// counts, the toolbar and footer are siblings of .MuiDataGrid-main, and only
// main holds the rowgroups. `role` is a prop here because the real root gets it
// from MUI (role="grid") or from the hook's forwardedProps (presentation),
// depending on which render won last.
function GridHarness({
  role = 'presentation',
  rowCount = 5,
  withMain = true,
}: {
  role?: string
  rowCount?: number
  withMain?: boolean
}) {
  const { ref } = useAccessibleGrid()
  return (
    <div
      ref={ref}
      data-testid="root"
      className="MuiDataGrid-root"
      role={role}
      aria-label="Users"
      aria-colcount={3}
      aria-rowcount={rowCount}
      aria-multiselectable={false}
    >
      <div className="MuiDataGrid-toolbarContainer">
        <input aria-label="Search" />
      </div>
      {withMain && (
        <div data-testid="main" className="MuiDataGrid-main">
          <div role="rowgroup" />
        </div>
      )}
      <div className="MuiDataGrid-footerContainer" />
    </div>
  )
}

test('moves the grid role and its aria attributes onto .MuiDataGrid-main', async () => {
  render(<GridHarness />)
  const root = screen.getByTestId('root')
  const main = screen.getByTestId('main')

  await waitFor(() => expect(main).toHaveAttribute('role', 'grid'))
  expect(main).toHaveAttribute('aria-label', 'Users')
  expect(main).toHaveAttribute('aria-colcount', '3')
  expect(main).toHaveAttribute('aria-rowcount', '5')
  expect(main).toHaveAttribute('aria-multiselectable', 'false')

  // Left on a presentational root they would be reported as aria-allowed-attr.
  expect(root).toHaveAttribute('role', 'presentation')
  expect(root).not.toHaveAttribute('aria-label')
  expect(root).not.toHaveAttribute('aria-colcount')
  expect(root).not.toHaveAttribute('aria-rowcount')
})

test('mirrors the counts again when the grid rewrites them', async () => {
  const { rerender } = render(<GridHarness rowCount={5} />)
  const main = screen.getByTestId('main')
  await waitFor(() => expect(main).toHaveAttribute('aria-rowcount', '5'))

  // What filtering, sorting, and paging do to the real grid.
  rerender(<GridHarness rowCount={9} />)

  await waitFor(() => expect(main).toHaveAttribute('aria-rowcount', '9'))
})

test('demotes a root that re-declares role="grid"', async () => {
  render(<GridHarness role="grid" />)

  await waitFor(() =>
    expect(screen.getByTestId('root')).toHaveAttribute('role', 'presentation')
  )
  expect(screen.getByTestId('main')).toHaveAttribute('role', 'grid')
})

test('leaves a grid without a main element untouched', async () => {
  // Every table test in this repo mocks the DataGrid away; the hook has to be
  // inert against a DOM that never renders MUI's internals.
  render(<GridHarness role="grid" withMain={false} />)

  await waitFor(() => expect(screen.getByTestId('root')).toBeInTheDocument())
  expect(screen.getByTestId('root')).toHaveAttribute('role', 'grid')
  expect(screen.getByTestId('root')).toHaveAttribute('aria-label', 'Users')
})

test('never carries one grid’s accessible name to the next', () => {
  // Against the real DataGrid, because the hazard is MUI's: it harvests the
  // grid's aria-* props by mutating the forwardedProps object it is handed, so
  // one shared object would label the dashboard grid "Users" the moment anyone
  // visited the users page.
  function Grid({ label }: { label?: string }) {
    const accessibleGrid = useAccessibleGrid()
    return (
      <DataGrid
        {...accessibleGrid}
        {...(label ? { 'aria-label': label } : {})}
        rows={[]}
        columns={[{ field: 'name' }]}
        autoHeight
      />
    )
  }

  const labeled = render(<Grid label="Users" />)
  expect(labeled.container.querySelector('.MuiDataGrid-main')).toHaveAttribute(
    'aria-label',
    'Users'
  )
  labeled.unmount()

  const unlabeled = render(<Grid />)
  expect(
    unlabeled.container.querySelector('.MuiDataGrid-main')
  ).not.toHaveAttribute('aria-label')
})

test('forwards a presentational role to the grid root', () => {
  // The hook cannot set `role` through a normal prop: DataGrid only forwards
  // aria-* and data-* attributes to its root element.
  let forwarded: Record<string, unknown> | undefined
  function Probe() {
    forwarded = useAccessibleGrid().forwardedProps
    return null
  }
  render(<Probe />)

  expect(forwarded).toEqual({ role: 'presentation' })
})
