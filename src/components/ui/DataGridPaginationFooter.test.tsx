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
