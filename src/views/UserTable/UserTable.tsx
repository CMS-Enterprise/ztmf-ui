import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ChecklistIcon from '@mui/icons-material/Checklist'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Close'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
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
  GridRenderEditCellParams,
  GridRowEditStopReasons,
  GridToolbarQuickFilter,
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
import { useContextProp } from '../Title/Context'
import Box from '@mui/material/Box'
import CustomSnackbar from '../Snackbar/Snackbar'
import AssignSystemModal from '../AssignSystemModal/AssignSystemModal'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES, ROLES } from '@/constants'
import EditInputCell from './EditInputCell'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
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
    <GridToolbarContainer sx={{ justifyContent: 'space-between' }}>
      <GridToolbarQuickFilter
        debounceMs={250}
        sx={{
          // '& .MuiInputBase-root:before': {
          //   borderBottomColor: '#5666b8',
          //   borderBottomWidth: 2,
          // },
          '& .MuiInputBase-input::placeholder': {
            color: '#404040', // Change placeholder color to red
            opacity: 0.8, // Ensure it is fully visible (MUI reduces opacity by default)
          },
          '& .MuiInputBase-root:after': {
            borderBottomColor: '#5666b8', // Changes the underline color when active
          },
          '& .MuiInputBase-root:hover:not(.Mui-disabled):before': {
            borderBottomColor: '#5666b8', // Changes the underline color on hover
          },
        }}
      />
      <Button
        color="primary"
        startIcon={<AddIcon />}
        onClick={addUserRow}
        sx={{ color: '#5666b8' }}
      >
        Add User
      </Button>
    </GridToolbarContainer>
  )
}
function validateEmail(email: string) {
  return /^[a-zA-Z0-9._:$!%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/.test(email)
}
export default function UserTable() {
  const apiRef = useGridApiRef()
  const navigate = useNavigate()
  //TODO: add these to a file to be imported and used in multiple places
  const checkValidResponse = (status: number) => {
    if (status == 401) {
      navigate(Routes.SIGNIN, {
        replace: true,
        state: {
          message: ERROR_MESSAGES.notSaved,
        },
      })
    }
    return
  }
  const renderSingleSelectEditCell = (params: GridRenderEditCellParams) => {
    const { value } = params
    return (
      <FormControl sx={{ minWidth: 120 }} error={!value} fullWidth>
        <Select
          sx={{
            '& .MuiOutlinedInput-input': {
              py: 1.7,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              mt: 0,
              '@supports (-moz-appearance:none)': {
                mt: -3, // Only applied in Firefox
              },
            },
          }}
          value={value || ''}
          onChange={(event) => {
            const fullname: string = params.api.getCellValue(
              params.id,
              'fullname'
            )
            if (event.target.value === 'ADMIN') {
              setUserName(fullname)
              setOpenAlert(true)
            }
            params.api.setEditCellValue(
              {
                id: params.id,
                field: params.field,
                value: event.target.value,
              },
              event
            )
          }}
          renderValue={(value) => `${value}`}
        >
          {ROLES.map((role) => (
            <MenuItem value={role} key={role}>
              {role}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    )
  }
  const [rows, setRows] = useState<users[]>([])
  const [userId, setUserId] = useState<GridRowId>('')
  const { fismaSystems } = useContextProp()
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({})
  const [open, setOpen] = useState<boolean>(false)
  const [snackBarText, setSnackBarText] = useState<string>('Saved')
  const [snackBarSeverity, setSnackBarSeverity] = useState<
    'success' | 'error' | 'warning' | 'info'
  >('success')
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
  const handleAlertCloseModal = (response: boolean) => {
    if (response == false && selectedRow) {
      apiRef.current.setEditCellValue({
        id: selectedRow.userid,
        field: 'role',
        value: selectedRow.role,
      })
    }
    setOpenAlert(false)
  }
  const handleUnautherized = (errorStatus: number) => {
    if (errorStatus === 403) {
      setSnackBarSeverity('error')
      setSnackBarText('You are not authorized to perform this action')
      setOpen(true)
    }
  }
  const handleEditClick = (id: GridRowId) => () => {
    const curRow = rows.find((row) => row.userid === id)
    setSelectedRow(curRow)
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } })
  }

  const handleSaveClick = (id: GridRowId) => () => {
    const curRow = apiRef.current.getRowWithUpdatedValues(id, '')
    if (
      !curRow?.email ||
      validateEmail(curRow?.email) === false ||
      !curRow?.fullname ||
      !curRow?.role
    ) {
      let errMessage: string = ''
      if (!curRow?.email || !curRow?.fullname || !curRow?.role) {
        errMessage = 'Please fill required fields'
      } else if (validateEmail(curRow?.email) === false) {
        errMessage = 'Please enter a valid email'
      }
      setSnackBarSeverity('error')
      setSnackBarText(errMessage)
      setOpen(true)
      setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } })
    } else {
      setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } })
    }
  }

  const handleCloseSnackbar = () => {
    setOpen(false)
  }
  const handleOpenModal = (id: GridRowId) => {
    setUserId(id)
    setOpenModal(true)
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
    const updatedRow = {
      ...selectedRow,
      ...newRow,
      isNew: false,
      role: newRow.role !== undefined ? newRow.role : selectedRow?.role ?? '',
    } as users
    const curRowUserId = updatedRow.userid
    if (newRow.isNew) {
      axiosInstance
        .post('/users', {
          email: updatedRow.email,
          fullname: updatedRow.fullname,
          role: updatedRow.role,
        })
        .then((res) => {
          newRow = res.data.data
          updatedRow.userid = newRow.userid
          apiRef.current.updateRows([
            { userid: curRowUserId, _action: 'delete' },
          ])
          apiRef.current.updateRows([updatedRow])
          setSnackBarSeverity('success')
          setSnackBarText('Saved')
          setOpen(true)
        })
        .catch((error) => {
          console.error('Error updating score:', error)
          checkValidResponse(error.response.status)
          handleUnautherized(error.response.status)
        })
    } else {
      // const updatedRow = { ...newRow } as users
      axiosInstance
        .put(`/users/${updatedRow?.userid}`, {
          email: updatedRow?.email,
          fullname: updatedRow?.fullname,
          role: updatedRow?.role,
        })
        .then((res) => {
          checkValidResponse(res.status)
          setSnackBarSeverity('success')
          setSnackBarText('Saved')
          setOpen(true)
        })
        .catch((error) => {
          if (error.response.status === 401) {
            checkValidResponse(error.response.status)
          } else if (error.response.status === 403) {
            handleUnautherized(error.response.status)
          } else {
            setSnackBarSeverity('error')
            setSnackBarText('An error occurred, please try again later')
            setOpen(true)
          }
        })
    }
    setRows(rows.map((row) => (row.userid === curRowUserId ? updatedRow : row)))
    return updatedRow
  }
  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel)
  }
  const handleProcessRowUpdateError = () => {
    setSnackBarSeverity('error')
    setSnackBarText('An error occurred while saving the row')
    setOpen(true)
  }

  // TODO: Custom hook for fetching data
  useEffect(() => {
    axiosInstance
      .get('/users')
      .then((res) => {
        if (res.status === 200) {
          const data = res.data.data.map((row: users) => ({
            ...row,
            role: row.role.trim(),
          }))
          setRows(data)
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
      .catch((error) => {
        if (error.response.status === 401) {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.error,
            },
          })
        }
      })
  }, [fismaSystems, navigate])
  const columns: GridColDef[] = [
    {
      field: 'fullname',
      headerName: 'Full Name',
      flex: 1,
      hideable: false,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <EditInputCell
          {...params}
          getErrorValue={() => {
            if (params?.value) {
              if (params.value.length === 0) {
                return true
              }
              return false
            }
            return true
          }}
        />
      ),
      editable: true,
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      hideable: false,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <EditInputCell
          {...params}
          getErrorValue={() => {
            if (params?.value) {
              if (params.value.length === 0) {
                return true
              }
              return validateEmail(params.value) === false
            }
            return true
          }}
        />
      ),
      editable: true,
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 1,
      editable: true,
      renderEditCell: renderSingleSelectEditCell,
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
      <BreadCrumbs />
      <Box
        sx={{
          height: 600,
          width: '100%',
          mb: 2,
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
            // '& .MuiFormControl-root.MuiTextField-root': {
            //   mt: 0,
            // },
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
        duration={2000}
        severity={snackBarSeverity}
        text={snackBarText}
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
