import { render, screen } from '@testing-library/react'
import { DataGrid } from '@mui/x-data-grid'
import DataGridPaginationFooter from '@/components/ui/DataGridPaginationFooter'

test('gives the page-size selector an accessible name', () => {
  render(
    <DataGrid
      rows={Array.from({ length: 30 }, (_, index) => ({
        id: index,
        name: `Row ${index}`,
      }))}
      columns={[{ field: 'name' }]}
      initialState={{
        pagination: { paginationModel: { page: 0, pageSize: 25 } },
      }}
      pageSizeOptions={[25, 50, 100]}
      slots={{ footer: DataGridPaginationFooter }}
    />
  )

  expect(
    screen.getByRole('combobox', { name: 'Rows per page' })
  ).toBeInTheDocument()
})

test('a server-paginated grid pages off the true total, not the loaded page', () => {
  // Server mode holds one page of rows, so a count derived from them would
  // strand the rest. 253 / 50 = 6 pages, and page 6 must be reachable.
  render(
    <DataGrid
      rows={Array.from({ length: 50 }, (_, index) => ({
        id: index,
        name: `Row ${index}`,
      }))}
      columns={[{ field: 'name' }]}
      paginationMode="server"
      rowCount={253}
      initialState={{
        pagination: { paginationModel: { page: 0, pageSize: 50 } },
      }}
      pageSizeOptions={[50]}
      slots={{ footer: DataGridPaginationFooter }}
      slotProps={{ footer: { rowCount: 253 } }}
    />
  )

  expect(
    screen.getByRole('button', { name: 'Go to page 6' })
  ).toBeInTheDocument()
})
