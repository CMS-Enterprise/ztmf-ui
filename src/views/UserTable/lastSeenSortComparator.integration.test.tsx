/**
 * Grid-level test for the Last Seen sort wiring. The pure comparator is
 * covered in lastSeen.test.ts with a simulated negation; this renders a real
 * DataGrid and clicks the header so the fragile part - the live
 * api.getSortModel() read inside lastSeenSortComparator while the grid
 * applies a new sort - is exercised for real, in both directions.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import useAccessibleGrid from '@/hooks/useAccessibleGrid'
import { lastSeenSortComparator, parseLastSeen } from './lastSeen'

type Row = { id: number; name: string; last_seen: string | null }

const rows: Row[] = [
  { id: 1, name: 'Leia Organa', last_seen: '2026-08-01T00:00:00Z' },
  { id: 2, name: 'Han Solo', last_seen: null },
  { id: 3, name: 'Luke Skywalker', last_seen: '2026-06-01T00:00:00Z' },
  { id: 4, name: 'Lando Calrissian', last_seen: null },
]

const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name' },
  {
    field: 'last_seen',
    headerName: 'Last Seen',
    type: 'dateTime',
    valueGetter: (params) => parseLastSeen(params.row.last_seen),
    sortComparator: lastSeenSortComparator,
  },
]

// Configured the way the app configures its grids, so the roles asserted below
// are the roles a user's screen reader meets.
function Grid() {
  const accessibleGrid = useAccessibleGrid()
  return (
    <DataGrid
      {...accessibleGrid}
      rows={rows}
      columns={columns}
      disableVirtualization
      autoHeight
    />
  )
}

function renderGrid() {
  return render(
    <div style={{ height: 500, width: 700 }}>
      <Grid />
    </div>
  )
}

/** Names in on-screen row order (skips the header row). */
function namesInOrder(): string[] {
  return (
    screen
      .getAllByRole('row')
      // Header row has columnheaders, not cells (ariaV7 renders gridcell).
      .filter((row) => within(row).queryAllByRole('gridcell').length > 0)
      .map((row) => within(row).getAllByRole('gridcell')[0].textContent ?? '')
  )
}

describe('lastSeenSortComparator in a real DataGrid', () => {
  it('keeps never-active rows last under asc AND desc header sorts', () => {
    renderGrid()
    const header = screen.getByRole('columnheader', { name: 'Last Seen' })

    // First click: ascending - oldest first, both nulls at the bottom.
    fireEvent.click(within(header).getByText('Last Seen'))
    expect(namesInOrder()).toEqual([
      'Luke Skywalker',
      'Leia Organa',
      'Han Solo',
      'Lando Calrissian',
    ])

    // Second click: descending - newest first, nulls STILL at the bottom
    // (the grid negates the comparator; the live-direction read compensates).
    fireEvent.click(within(header).getByText('Last Seen'))
    expect(namesInOrder()).toEqual([
      'Leia Organa',
      'Luke Skywalker',
      'Han Solo',
      'Lando Calrissian',
    ])
  })
})
