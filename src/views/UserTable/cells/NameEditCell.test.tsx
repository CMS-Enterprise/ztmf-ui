import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DataGrid,
  GridApi,
  GridRenderEditCellParams,
  useGridApiRef,
} from '@mui/x-data-grid'
import type { MutableRefObject } from 'react'
import NameEditCell from './NameEditCell'

// Mirrors the Users grid wiring: the Name column's edit cell also edits the
// email, which lives in a hidden column of its own.
let gridApi: MutableRefObject<GridApi>

function Grid() {
  gridApi = useGridApiRef()
  return (
    <DataGrid
      apiRef={gridApi}
      editMode="row"
      rows={[
        {
          id: 'u1',
          userid: 'u1',
          fullname: 'Grand Moff Tarkin',
          email: 'tarkin@deathstar.empire',
        },
      ]}
      columns={[
        {
          field: 'fullname',
          editable: true,
          renderEditCell: (params: GridRenderEditCellParams) => (
            <NameEditCell {...params} />
          ),
        },
        { field: 'email', editable: true, width: 0 },
      ]}
    />
  )
}

async function startEditing() {
  render(<Grid />)
  act(() => {
    gridApi.current.startRowEditMode({ id: 'u1' })
  })
  return screen.findByPlaceholderText('Email')
}

test('the email input accepts typing and feeds the row edit', async () => {
  const user = userEvent.setup()
  const email = await startEditing()

  await user.clear(email)
  await user.type(email, 'wilhuff.tarkin@empire.gov')

  expect(email).toHaveValue('wilhuff.tarkin@empire.gov')
  expect(gridApi.current.getRowWithUpdatedValues('u1', 'email').email).toBe(
    'wilhuff.tarkin@empire.gov'
  )
})

test('the email input starts from the saved address', async () => {
  const email = await startEditing()

  expect(email).toHaveValue('tarkin@deathstar.empire')
})
