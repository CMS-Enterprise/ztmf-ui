import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ChecklistIcon from '@mui/icons-material/Checklist'
import DomainIcon from '@mui/icons-material/Domain'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import RestoreIcon from '@mui/icons-material/RestoreFromTrash'
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
import { Chip, FormControlLabel, Switch, Typography } from '@mui/material'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import Tooltip from '@mui/material/Tooltip'
import './UserTable.css'
import axiosInstance from '@/axiosConfig'
import { users, OpDiv } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead,
  hasUnscopedRead,
  isOpDivTier,
  selectableRoles,
} from '@/utils/userRoles'
import { fetchOpDivs } from '@/utils/opdivs'
import { fetchUserOpDivs, grantOpDiv } from '@/utils/userOpdivs'
import CONFIG from '@/utils/config'
import EditOpDivCell from './EditOpDivCell'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { useContextProp } from '../Title/Context'
import Box from '@mui/material/Box'
import CustomSnackbar from '../Snackbar/Snackbar'
import AssignSystemModal from '../AssignSystemModal/AssignSystemModal'
import OpDivGrantModal from '../OpDivGrantModal/OpDivGrantModal'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES, STATUS_MESSAGES } from '@/constants'
import EditInputCell from './EditInputCell'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
interface EditToolbarProps {
  setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void
  setRowModesModel: (
    newModel: (oldModel: GridRowModesModel) => GridRowModesModel
  ) => void
  isAdmin?: boolean
  showDeleted: boolean
  setShowDeleted: (value: boolean) => void
}

function EditToolbar(props: EditToolbarProps) {
  const { setRows, setRowModesModel, isAdmin, showDeleted, setShowDeleted } =
    props
  const addUserRow = () => {
    const userid = Math.floor(Math.random() * 1000) + 1
    setRows((oldRows) => [
      ...oldRows,
      {
        userid,
        fullname: '',
        email: '',
        role: '',
        isNew: true,
      },
    ])
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [userid]: { mode: GridRowModes.Edit, fieldToFocus: 'fullname' },
    }))
  }
  return (
    <GridToolbarContainer sx={{ justifyContent: 'space-between' }}>
      <GridToolbarQuickFilter
        debounceMs={250}
        sx={{
          '& .MuiInputBase-input::placeholder': {
            color: '#404040',
            opacity: 0.8,
          },
          '& .MuiInputBase-root:after': {
            borderBottomColor: '#5666b8',
          },
          '& .MuiInputBase-root:hover:not(.Mui-disabled):before': {
            borderBottomColor: '#5666b8',
          },
        }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#004297',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#004297',
                },
              }}
            />
          }
          label="Show Deleted"
        />
        {isAdmin && !showDeleted && (
          <Button
            color="primary"
            startIcon={<AddIcon />}
            onClick={addUserRow}
            sx={{ color: '#5666b8' }}
          >
            Add User
          </Button>
        )}
      </Box>
    </GridToolbarContainer>
  )
}
function validateEmail(email: string) {
  return /^[a-zA-Z0-9._:$!%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/.test(email)
}
export default function UserTable() {
  const apiRef = useGridApiRef()
  const navigate = useNavigate()
  const { userInfo, fismaSystems } = useContextProp()
  // Write-tier admins get the create/edit/delete/assign controls; read-only
  // admins may view the table but every mutating control is withheld. The
  // backend is the security boundary - this only governs which controls render.
  const isAdmin = checkIsAdmin(userInfo)
  const canRead = hasAdminRead(userInfo)
  // Roles this admin may assign; also the valid option set for the role editor.
  const assignableRoles = selectableRoles(userInfo.role)
  const showIdpSelector = CONFIG.IDP_ENABLED && hasUnscopedRead(userInfo)
  useEffect(() => {
    if (userInfo.role && !canRead) {
      navigate(Routes.ROOT, { replace: true })
    }
  }, [userInfo.role, canRead, navigate])
  const [rows, setRows] = useState<users[]>([])
  const [userId, setUserId] = useState<GridRowId>('')
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({})
  const [open, setOpen] = useState<boolean>(false)
  const [snackBarText, setSnackBarText] = useState<string>(
    STATUS_MESSAGES.saved
  )
  const [snackBarSeverity, setSnackBarSeverity] = useState<
    'success' | 'error' | 'warning' | 'info'
  >('success')
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [selectedRow, setSelectedRow] = useState<users | undefined>({
    userid: '',
    email: '',
    fullname: '',
    role: '' as users['role'],
    assignedfismasystems: [],
  })
  const [fismaSystemsMap, setFismaSystemsMap] = useState<
    Record<number, { name: string; acronym: string }>
  >({})
  const [showDeleted, setShowDeleted] = useState<boolean>(false)
  const [pendingDeleteRow, setPendingDeleteRow] = useState<users | null>(null)
  const [pendingRestoreRow, setPendingRestoreRow] = useState<users | null>(null)
  const [assignModalUserName, setAssignModalUserName] = useState<string>('')
  const [openOpDivModal, setOpenOpDivModal] = useState<boolean>(false)
  const [opdivModalUserId, setOpDivModalUserId] = useState<GridRowId>('')
  const [opdivModalUserName, setOpDivModalUserName] = useState<string>('')
  const [opdivOptions, setOpDivOptions] = useState<OpDiv[]>([])
  // opdiv_id -> code, for rendering the OpDivs membership column.
  const [opdivCodeMap, setOpDivCodeMap] = useState<Record<number, string>>({})
  // userid -> granted opdiv ids, used as a refresh override after the grant modal
  // closes. The list now returns grants inline (assignedopdivids); this map only
  // holds rows refreshed since load, plus a one-time backfill against older
  // backends that omit the inline grants (see the load effect).
  const [userOpDivMap, setUserOpDivMap] = useState<Record<string, number[]>>({})
  const handleRowEditStop: GridEventListener<'rowEditStop'> = (
    params,
    event
  ) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true
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
    const row = rows.find((r) => r.userid === id)
    setAssignModalUserName(row?.fullname ?? '')
    setOpenModal(true)
  }
  const handleCloseModal = () => {
    setOpenModal(false)
  }
  const handleOpenOpDivModal = (id: GridRowId) => {
    setOpDivModalUserId(id)
    const row = rows.find((r) => r.userid === id)
    setOpDivModalUserName(row?.fullname ?? '')
    setOpenOpDivModal(true)
  }
  // Pull a single user's current OpDiv grants and derived identity_provider
  // and patch them onto the row. Called after a confirmed grant/revoke (the
  // backend recomputes identity_provider, which can flip okta <-> entra) and
  // again on modal close as a backstop. Each call targets its own row, so a
  // late response can't contaminate a different user.
  const refreshUserRow = (userid: string) => {
    if (!userid) return
    fetchUserOpDivs(userid)
      .then((ids) => setUserOpDivMap((prev) => ({ ...prev, [userid]: ids })))
      .catch((error) => {
        // Non-blocking refresh: keep the previous grants but surface that the
        // displayed row may be stale.
        console.error(
          `Failed to refresh OpDiv grants for user ${userid}`,
          error
        )
        notify(ERROR_MESSAGES.refresh, 'warning')
      })
    axiosInstance
      .get(`/users/${userid}`)
      .then((res) => {
        const idp = res.data?.data?.identity_provider
        setRows((prev) =>
          prev.map((row) =>
            row.userid === userid ? { ...row, identity_provider: idp } : row
          )
        )
      })
      .catch((error) => {
        console.error(`Failed to refresh user row for ${userid}`, error)
      })
  }
  const handleCloseOpDivModal = () => {
    setOpenOpDivModal(false)
    refreshUserRow(String(opdivModalUserId))
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
  const processRowUpdate = async (newRow: GridRowModel) => {
    const updatedRow = {
      ...selectedRow,
      ...newRow,
      isNew: false,
      role: newRow.role !== undefined ? newRow.role : selectedRow?.role ?? '',
    } as users
    const curRowUserId = updatedRow.userid
    if (newRow.isNew) {
      try {
        const idpValue = newRow.identity_provider
        const body = {
          email: updatedRow.email,
          fullname: updatedRow.fullname,
          role: updatedRow.role,
          ...(showIdpSelector &&
            (idpValue === 'okta' || idpValue === 'entra') && {
              identity_provider: idpValue,
            }),
        }

        const res = await axiosInstance.post('/users', body)
        const createdUser = res.data.data
        updatedRow.userid = createdUser.userid

        const opdivIdsToGrant = (newRow.opdivs as number[] | undefined) ?? []
        const grantResults = await Promise.allSettled(
          opdivIdsToGrant.map((opdivId) =>
            grantOpDiv(createdUser.userid, opdivId)
          )
        )

        if (
          grantResults.some(
            (r) => r.status === 'rejected' && isAuthHandled(r.reason)
          )
        ) {
          return updatedRow
        }

        const succeededIds = opdivIdsToGrant.filter(
          (_, i) => grantResults[i].status === 'fulfilled'
        )
        setUserOpDivMap((prev) => ({
          ...prev,
          [createdUser.userid]: succeededIds,
        }))
        updatedRow.assignedopdivids = succeededIds

        if (opdivIdsToGrant.length > 0) {
          // Backend recomputes identity_provider after OpDiv grants — leave blank
          // until refreshUserRow returns the authoritative value.
          refreshUserRow(createdUser.userid)
        } else {
          updatedRow.identity_provider = createdUser.identity_provider ?? ''
        }

        apiRef.current.updateRows([{ userid: curRowUserId, _action: 'delete' }])
        apiRef.current.updateRows([updatedRow])

        const failCount = opdivIdsToGrant.length - succeededIds.length
        setSnackBarSeverity(failCount > 0 ? 'warning' : 'success')
        setSnackBarText(
          failCount > 0
            ? `User created, but ${failCount} OpDiv grant(s) failed. Use Assign OpDivs to retry.`
            : STATUS_MESSAGES.saved
        )
        setOpen(true)
      } catch (error) {
        if (isAuthHandled(error)) return updatedRow
        console.error('Error creating user:', error)
        setSaveError(error)
      }
    } else {
      try {
        await axiosInstance.put(`/users/${updatedRow?.userid}`, {
          email: updatedRow?.email,
          fullname: updatedRow?.fullname,
          role: updatedRow?.role,
        })
        setSnackBarSeverity('success')
        setSnackBarText(STATUS_MESSAGES.saved)
        setOpen(true)
      } catch (error) {
        if (isAuthHandled(error)) return updatedRow
        console.error('Error saving user:', error)
        setSaveError(error)
      }
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
  // Surface the backend's specific reason on a failed save. On a 400 the body
  // carries a field -> message map (e.g. a duplicate email); join those so the
  // user sees what to fix rather than a generic retry message.
  const setSaveError = (error: unknown) => {
    const parsed = parseApiError(error)
    const message = parsed.fieldErrors
      ? Object.values(parsed.fieldErrors).join(' ')
      : parsed.message
    setSnackBarSeverity('error')
    setSnackBarText(message)
    setOpen(true)
  }
  const handleDeleteClick = (id: GridRowId) => () => {
    const curRow = apiRef.current.getRow(id) as users | undefined
    if (!curRow) return
    setPendingDeleteRow(curRow)
  }
  const handleConfirmDelete = async (confirm: boolean) => {
    const target = pendingDeleteRow
    setPendingDeleteRow(null)
    if (!confirm || !target) return
    try {
      await axiosInstance.delete(`/users/${target.userid}`)
      setRows((prev) => prev.filter((row) => row.userid !== target.userid))
      notify(`Saved - Delete User ${target.fullname}`, 'success', {
        autoHideDuration: 2000,
      })
    } catch (error) {
      if (isAuthHandled(error)) return
      notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 2000 })
    }
  }
  const handleRestoreClick = (id: GridRowId) => () => {
    const curRow = apiRef.current.getRow(id) as users | undefined
    if (!curRow) return
    setPendingRestoreRow(curRow)
  }
  const handleConfirmRestore = async (confirm: boolean) => {
    const target = pendingRestoreRow
    setPendingRestoreRow(null)
    if (!confirm || !target) return
    try {
      await axiosInstance.put(`/users/${target.userid}/restore`)
      setRows((prev) => prev.filter((row) => row.userid !== target.userid))
      notify(`Saved - Restore User ${target.fullname}`, 'success', {
        autoHideDuration: 2000,
      })
    } catch (error) {
      if (isAuthHandled(error)) return
      notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 2000 })
    }
  }
  // TODO: Custom hook for fetching data
  useEffect(() => {
    if (!canRead) return
    const controller = new AbortController()
    // backfillAborted guards the Promise.all per-user calls, which can't receive
    // a signal since fetchUserOpDivs doesn't accept one.
    let backfillAborted = false
    async function load() {
      try {
        const res = await axiosInstance.get('/users', {
          params: { deleted: showDeleted },
          signal: controller.signal,
        })
        if (res.status !== 200) return
        const data = res.data.data.map((row: users) => ({
          ...row,
          role: row.role.trim(),
        }))
        setRows(data)
        const map: Record<number, { name: string; acronym: string }> = {}
        for (const obj of fismaSystems) {
          map[obj.fismasystemid] = {
            name: obj.fismasubsystem
              ? obj.fismaname + ' - ' + obj.fismasubsystem
              : obj.fismaname,
            acronym: obj.fismaacronym,
          }
        }
        setFismaSystemsMap(map)
        // Grants now arrive inline on each list row (assignedopdivids), so the
        // OpDivs column reads them directly with no per-user calls. Fall back to
        // the per-user detail endpoint only against an older backend that omits
        // them, keeping this safe to ship before or after the backend deploys.
        // Distinguish "old backend omitted the field" (key absent -> backfill)
        // from "new backend, user simply has zero grants" (key present, value
        // null/[] -> no backfill). A value check would misfire on every
        // zero-grant user and re-introduce the N+1.
        const missingInlineGrants = data.some(
          (u: users) => !('assignedopdivids' in u)
        )
        if (missingInlineGrants) {
          try {
            const entries = await Promise.all(
              data.map((u: users) =>
                fetchUserOpDivs(u.userid)
                  .then((ids) => [u.userid, ids] as [string, number[]])
                  .catch(() => [u.userid, []] as [string, number[]])
              )
            )
            if (backfillAborted) return
            // Merge rather than replace so an in-flight per-user refresh
            // (e.g. from closing the grant modal) is not clobbered.
            setUserOpDivMap((prev) => ({
              ...prev,
              ...Object.fromEntries(entries),
            }))
          } catch (error) {
            if (backfillAborted) return
            // The per-user catches above already default to [], so this only
            // trips on an unexpected failure. Surface it rather than leaving
            // the OpDivs column silently blank.
            console.error('Failed to backfill OpDiv grants', error)
            notify(ERROR_MESSAGES.tryAgain, 'warning')
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Fetch users error:', error)
        notify(ERROR_MESSAGES.tryAgain, 'error')
      }
    }
    load()
    return () => {
      controller.abort()
      backfillAborted = true
    }
  }, [canRead, fismaSystems, navigate, showDeleted])
  // OpDiv options for the grant modal: assignable children only (the HHS
  // parent row is not a grantable tenant). An OPDIV_ADMIN may only grant their
  // own OpDivs, so narrow the option set to their own grants; the server
  // enforces the same rule.
  useEffect(() => {
    if (!isAdmin) return
    // Pull the full list (incl. inactive/parent) so any granted id resolves to
    // a code in the OpDivs column; derive the assignable subset from the same
    // response for the grant modal.
    async function loadOpDivs() {
      try {
        const all = await fetchOpDivs(true)
        const codeMap: Record<number, string> = {}
        all.forEach((od) => {
          codeMap[od.opdiv_id] = od.code
        })
        setOpDivCodeMap(codeMap)

        let assignable = all.filter((od) => !od.is_parent && od.active)
        if (isOpDivTier(userInfo)) {
          const own = new Set(userInfo.assignedopdivids ?? [])
          assignable = assignable.filter((od) => own.has(od.opdiv_id))
        }
        setOpDivOptions(assignable)
      } catch {
        // Non-fatal: the grant modal simply shows no options if this fails.
        setOpDivOptions([])
        setOpDivCodeMap({})
      }
    }
    loadOpDivs()
  }, [isAdmin, userInfo])
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
      editable: isAdmin,
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
      editable: isAdmin,
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 1,
      editable: isAdmin,
      // Native DataGrid dropdown, scoped to the roles this admin may assign.
      type: 'singleSelect',
      valueOptions: assignableRoles,
    },
    {
      field: 'opdivs',
      headerName: 'OpDivs',
      flex: 1,
      sortable: false,
      filterable: false,
      editable: isAdmin,
      renderEditCell: (params) => (
        <EditOpDivCell {...params} opdivOptions={opdivOptions} />
      ),
      renderCell: (params) => {
        // Refresh override (post grant-modal) wins; otherwise use the grants the
        // list returned inline on the row.
        const ids =
          userOpDivMap[params.row.userid] ?? params.row.assignedopdivids ?? []
        if (!ids.length) {
          return (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          )
        }
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
            {ids.map((id) => (
              <Chip key={id} size="small" label={opdivCodeMap[id] ?? id} />
            ))}
          </Box>
        )
      },
    },
    {
      field: 'identity_provider',
      headerName: 'IdP',
      flex: 0.5,
      editable: showIdpSelector,
      type: 'singleSelect',
      valueOptions: ['okta', 'entra'],
      // renderCell controls view-mode display; shows '—' for unset values.
      // HHS-wide admins can set this on new rows; for existing rows the backend
      // derives it from OpDiv membership.
      renderCell: (params) => params.row.identity_provider || '—',
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 140,
      cellClassName: 'actions',
      getActions: (params) => {
        // Read-only admins see the table but no mutating controls.
        if (!isAdmin) return []
        const isInEditMode =
          rowModesModel[params.id]?.mode === GridRowModes.Edit
        if (isInEditMode) {
          return [
            <GridActionsCellItem
              icon={<SaveIcon />}
              label="Save"
              sx={{
                color: 'primary.main',
              }}
              key={`save-${params.id}`}
              onClick={handleSaveClick(params.id)}
            />,
            <GridActionsCellItem
              icon={<CancelIcon />}
              key={`cancel-${params.id}`}
              label="Cancel"
              className="textPrimary"
              onClick={handleCancelClick(params.id)}
              color="inherit"
            />,
          ]
        }

        // Mirror the backend CanManageUser rule: an admin can only manage a
        // user whose role is within their assignable tier (the list is already
        // OpDiv-scoped server-side). Withhold edit/assign/delete/restore for
        // out-of-tier targets so they don't hit a 403. New rows (blank role,
        // mid-create) are handled by the edit-mode branch above.
        if (!assignableRoles.includes(params.row.role)) return []

        if (params.row.deleted) {
          return [
            <Tooltip
              title="Restore User"
              key={`tooltip-restore-${params.id}`}
              placement="right-start"
            >
              <GridActionsCellItem
                icon={<RestoreIcon sx={{ color: 'black' }} />}
                key={`restore-${params.id}`}
                label="Restore"
                onClick={handleRestoreClick(params.id)}
                color="inherit"
              />
            </Tooltip>,
          ]
        }

        return [
          <GridActionsCellItem
            icon={<EditIcon />}
            key={`edit-${params.id}`}
            label="Edit"
            className="textPrimary"
            onClick={handleEditClick(params.id)}
            color="inherit"
          />,
          <Tooltip
            title={`Assign Fisma Systems`}
            key={`tooltip-${params.id}`}
            placement="right-start"
          >
            <GridActionsCellItem
              icon={<ChecklistIcon sx={{ color: 'black' }} />}
              key={`assignsystem-${params.id}`}
              label="assignedSystems"
              onClick={() => handleOpenModal(params.id)}
              color="inherit"
            />
          </Tooltip>,
          <Tooltip
            title={`Assign OpDivs`}
            key={`tooltip-opdiv-${params.id}`}
            placement="right-start"
          >
            <GridActionsCellItem
              icon={<DomainIcon sx={{ color: 'black' }} />}
              key={`assignopdiv-${params.id}`}
              label="assignedOpDivs"
              onClick={() => handleOpenOpDivModal(params.id)}
              color="inherit"
            />
          </Tooltip>,
          <GridActionsCellItem
            key={`delete-${params.id}`}
            icon={<DeleteIcon sx={{ color: 'black' }} />}
            label="Delete"
            onClick={handleDeleteClick(params.id)}
            color="inherit"
          />,
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
          aria-label="Users"
          rows={rows}
          apiRef={apiRef}
          columns={columns}
          // Cell-level edit gates (defense-in-depth; server enforces the same rules):
          // - role: locked on existing rows whose current role is outside this
          //   admin's assignable tier, preventing unauthorized role changes.
          // - opdivs / identity_provider: locked to new rows only — existing
          //   users' OpDiv memberships and derived IdP are managed via the
          //   Assign OpDivs action, not inline editing.
          isCellEditable={(params) => {
            if (params.field === 'role') {
              return (
                params.row.isNew ||
                !params.row.role ||
                assignableRoles.includes(params.row.role)
              )
            }
            if (
              params.field === 'opdivs' ||
              params.field === 'identity_provider'
            ) {
              return !!params.row.isNew
            }
            return true
          }}
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
            toolbar: {
              setRows,
              setRowModesModel,
              isAdmin,
              showDeleted,
              setShowDeleted,
            },
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
        userName={assignModalUserName}
      />
      <OpDivGrantModal
        open={openOpDivModal}
        handleClose={handleCloseOpDivModal}
        userid={opdivModalUserId}
        userName={opdivModalUserName}
        opdivOptions={opdivOptions}
        onChanged={refreshUserRow}
      />
      <ConfirmDialog
        title="Confirm User Deletion"
        confirmationText={
          pendingDeleteRow
            ? `Are you sure you want to delete ${pendingDeleteRow.fullname}? This will remove their access to ZTMF. The user can be restored later from the "Show Deleted" view.`
            : ''
        }
        open={pendingDeleteRow !== null}
        onClose={() => setPendingDeleteRow(null)}
        confirmClick={handleConfirmDelete}
        confirmLabel="Delete"
      />
      <ConfirmDialog
        title="Confirm User Restore"
        confirmationText={
          pendingRestoreRow
            ? `Restore ${pendingRestoreRow.fullname}? This will re-enable their access to ZTMF.`
            : ''
        }
        open={pendingRestoreRow !== null}
        onClose={() => setPendingRestoreRow(null)}
        confirmClick={handleConfirmRestore}
        confirmLabel="Restore"
      />
    </>
  )
}
