import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ChecklistIcon from '@mui/icons-material/Checklist'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Close'
import {
  GridRowsProp,
  GridRowModesModel,
  GridRowModes,
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridActionsCellItem,
  GridEventListener,
  GridRowId,
  GridRowModel,
  GridRowEditStopReasons,
} from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import './UserTable.css'
import axiosInstance from '@/axiosConfig'
import { users } from '@/types'
import { useFismaSystems } from '../Title/Context'
import Box from '@mui/material/Box'
import SavedSnackbar from '../Snackbar/Snackbar'
import AssignSystemModal from '../AssignSystemModal/AssignSystemModal'
const roles = ['ISSO', 'ISSM', 'ADMIN']

interface EditToolbarProps {
  setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void
  setRowModesModel: (
    newModel: (oldModel: GridRowModesModel) => GridRowModesModel
  ) => void
}
function EditToolbar(props: EditToolbarProps) {
  const { setRows, setRowModesModel } = props
  const addUserRow = () => {
    const userid = Math.floor(Math.random() * 1000) + 1
    setRows((oldRows) => [
      ...oldRows,
      { userid, fullname: '', email: '', role: '', isNew: true },
    ])
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [userid]: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
    }))
  }

  return (
    <GridToolbarContainer>
      <Button color="primary" startIcon={<AddIcon />} onClick={addUserRow}>
        Add Users
      </Button>
    </GridToolbarContainer>
  )
}

export default function UserTable() {
  const [rows, setRows] = useState<users[]>([])
  const [userId, setUserId] = useState<GridRowId>('')
  const { fismaSystems } = useFismaSystems()
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({})
  const [open, setOpen] = useState<boolean>(false)
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [fismaSystemsMap, setFismaSystemsMap] = useState<
    Record<number, string>
  >({})
  const handleRowEditStop: GridEventListener<'rowEditStop'> = (
    params,
    event
  ) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true
    }
  }

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } })
  }

  const handleSaveClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } })
  }

  const handleCloseSnackbar = () => {
    setOpen(false)
  }
  const handleOpenModal = (id: GridRowId) => {
    setOpenModal(true)
    setUserId(id)
  }
  const handleCloseModal = () => {
    setOpenModal(false)
  }
  const handleCancelClick = (id: GridRowId) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    })

    const editedRow = rows.find((row) => row.userid === id)
    if (editedRow!.isNew) {
      setRows(rows.filter((row) => row.userid !== id))
    }
  }

  const processRowUpdate = (newRow: GridRowModel) => {
    let newUser = {} as users
    if (newRow.isNew) {
      axiosInstance
        .post('/users', {
          email: newRow.email,
          fullname: newRow.fullname,
          role: newRow.role,
        })
        .then((res) => {
          newUser = res.data.data
          setRows(
            rows.map((row) =>
              row.userid === newRow.userid
                ? { ...updatedRow, userid: newUser.userid }
                : row
            )
          )
          setOpen(true)
        })
    } else {
      const updatedRow = { ...newRow } as users
      axiosInstance
        .put(`/users/${updatedRow?.userid}`, {
          email: updatedRow?.email,
          fullname: updatedRow?.fullname,
          role: updatedRow?.role,
        })
        .then((res) => {
          if (res.status != 204) {
            return console.error('Error updating score')
          }
          setOpen(true)
        })
        .catch((error) => {
          console.error('Error updating score:', error)
        })
      setRows(
        rows.map((row) => (row.userid === newRow.userid ? updatedRow : row))
      )
    }
    const updatedRow = { ...newRow, isNew: false } as users
    return updatedRow
  }

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel)
  }

  // TODO: Custom hook for fetching data
  useEffect(() => {
    axiosInstance.get('/users').then((res) => {
      if (res.status === 200) {
        setRows(res.data.data)
        const map: Record<number, string> = {}
        for (const obj of fismaSystems) {
          map[obj.fismasystemid] = obj.fismasubsystem
            ? obj.fismaname + ' - ' + obj.fismasubsystem
            : obj.fismaname
        }
        setFismaSystemsMap(map)
      } else {
        return
      }
    })
  }, [fismaSystems])
  const columns: GridColDef[] = [
    {
      field: 'fullname',
      headerName: 'Full Name',
      flex: 1,
      hideable: false,
      editable: true,
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      hideable: false,
      editable: true,
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 1,
      editable: true,
      type: 'singleSelect',
      valueGetter: (value) => {
        return value.row.role
      },
      valueOptions: roles,
      cellClassName: 'single-select-dropdown',
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      cellClassName: 'actions',
      getActions: ({ id }) => {
        const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit
        if (isInEditMode) {
          return [
            <GridActionsCellItem
              icon={<SaveIcon />}
              label="Save"
              sx={{
                color: 'primary.main',
              }}
              key={`save-${id}`}
              onClick={handleSaveClick(id)}
            />,
            <GridActionsCellItem
              icon={<CancelIcon />}
              key={`cancel-${id}`}
              label="Cancel"
              className="textPrimary"
              onClick={handleCancelClick(id)}
              color="inherit"
            />,
          ]
        }

        return [
          <GridActionsCellItem
            icon={<EditIcon />}
            key={`edit-${id}`}
            label="Edit"
            className="textPrimary"
            onClick={handleEditClick(id)}
            color="inherit"
          />,
          <Tooltip
            title={`Assign Fisma Systems`}
            key={`tooltip-${id}`}
            placement="right-start"
          >
            <GridActionsCellItem
              icon={<ChecklistIcon />}
              key={id}
              label="assignedSystems"
              onClick={() => handleOpenModal(id)}
              color="inherit"
            />
          </Tooltip>,
        ]
      },
    },
  ]

  return (
    <>
      <Box
        sx={{
          height: 600,
          width: '100%',
          '& .actions': {
            color: 'text.secondary',
          },
          '& .textPrimary': {
            color: 'text.primary',
          },
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          editMode="row"
          getRowId={(row) => row.userid}
          initialState={{
            sorting: {
              sortModel: [{ field: 'role', sort: 'asc' }],
            },
          }}
          rowModesModel={rowModesModel}
          onRowModesModelChange={handleRowModesModelChange}
          onRowEditStop={handleRowEditStop}
          processRowUpdate={processRowUpdate}
          slots={{
            toolbar: EditToolbar,
          }}
          slotProps={{
            toolbar: { setRows, setRowModesModel },
            filterPanel: {
              sx: {
                '& .MuiFormLabel-root': {
                  marginTop: 1,
                },
              },
            },
          }}
          disableColumnSelector
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#004297',
              color: '#fff',
            },
            '& .MuiDataGrid-menuIconButton': {
              color: '#fff',
            },
            '& .MuiDataGrid-menuIcon': {
              color: '#fff',
            },
            '& .MuiDataGrid-sortIcon': {
              color: '#fff',
            },
            '& .MuiFormControl-root.MuiTextField-root': {
              mt: 0,
            },
            '& .MuiTablePagination-selectLabel': {
              mb: 2,
            },
            '& .MuiTablePagination-displayedRows': {
              mb: 2,
            },
          }}
        />
      </Box>
      <SavedSnackbar open={open} handleClose={handleCloseSnackbar} />
      <AssignSystemModal
        fismaSystemMap={fismaSystemsMap}
        open={openModal}
        handleClose={handleCloseModal}
        userid={userId}
      />
    </>
  )
}
