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
  GridPreProcessEditCellProps,
  GridRowEditStopReasons,
  useGridApiRef,
} from '@mui/x-data-grid'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import Tooltip from '@mui/material/Tooltip'
import './UserTable.css'
import axiosInstance from '@/axiosConfig'
import { users } from '@/types'
import { useFismaSystems } from '../Title/Context'
import Box from '@mui/material/Box'
import CustomSnackbar from '../Snackbar/Snackbar'
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
  const apiRef = useGridApiRef()
  const [rows, setRows] = useState<users[]>([])
  const [userId, setUserId] = useState<GridRowId>('')
  const { fismaSystems } = useFismaSystems()
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({})
  const [open, setOpen] = useState<boolean>(false)
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [openAlert, setOpenAlert] = useState<boolean>(false)
  const [selectedRow, setSelectedRow] = useState<users | undefined>({
    userid: '',
    email: '',
    fullname: '',
    role: '',
    assignedfismasystems: [],
  })
  const [userName, setUserName] = useState<string | undefined>(undefined)
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
  const preProcessEditCellProps = (params: GridPreProcessEditCellProps) => {
    if (params.hasChanged) {
      const curRow = rows.find((row) => row.userid === params.id)
      setSelectedRow(curRow)
      if (params.props.value === 'ADMIN' && curRow?.role !== 'ADMIN') {
        setUserName(curRow?.fullname)
        setOpenAlert(true)
      }
    }
    return Promise.resolve()
  }
  const handleAlertCloseModal = (response: boolean) => {
    if (response == false && selectedRow) {
      apiRef.current.setEditCellValue({
        id: selectedRow.userid,
        field: 'role',
        value: selectedRow.role, // Replace with the desired value
      })
    }
    setOpenAlert(false)
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
    if (newRow.isNew) {
      let newUser = {} as users
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
  const handleProcessRowUpdateError = (error: unknown) => {
    console.error('Error updating row:', error)
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
      valueOptions: roles,
      preProcessEditCellProps,
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
          apiRef={apiRef}
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
          onProcessRowUpdateError={handleProcessRowUpdateError}
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
      <CustomSnackbar
        open={open}
        handleClose={handleCloseSnackbar}
        severity="success"
        text="Saved"
      />
      <AssignSystemModal
        fismaSystemMap={fismaSystemsMap}
        open={openModal}
        handleClose={handleCloseModal}
        userid={userId}
      />
      <Dialog
        open={openAlert}
        onClose={() => setOpenAlert(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <div>
            <Typography variant="h4">Confirm Role Change</Typography>
          </div>
        </DialogTitle>
        <DialogContent>
          <Box>
            <Typography variant="h6">
              Are you sure you want to change {userName} as an ADMIN?
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={() => handleAlertCloseModal(false)}>No</CmsButton>
          <CmsButton onClick={() => handleAlertCloseModal(true)}>Yes</CmsButton>
        </DialogActions>
      </Dialog>
    </>
  )
}
