import { useEffect, useMemo, useState } from 'react'
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
  GridFilterModel,
  useGridApiRef,
} from '@mui/x-data-grid'
import useAccessibleGrid from '@/hooks/useAccessibleGrid'
import { Chip, FormControlLabel, Switch, Typography } from '@mui/material'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import Tooltip from '@mui/material/Tooltip'
import './UserTable.css'
import axiosInstance from '@/axiosConfig'
import { apiPaths } from '@/api/keys'
import { users, FismaSystemType } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead,
  hasUnscopedRead,
  isUnscopedWriteAdmin,
  selectableRoles,
} from '@/utils/userRoles'
import { useSetUserOpDivs } from '@/utils/userOpdivs'
import CONFIG from '@/utils/config'
import EditOpDivCell from './EditOpDivCell'
import { isUserCellEditable } from './cellEditGuards'
import {
  buildOpDivCodeMap,
  buildOpDivLabelMap,
  buildAssignableOpDivs,
  narrowToCallerScope,
} from './opdivDerivations'
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
import LastSeenCell from './LastSeenCell'
import {
  lastSeenSortComparator,
  parseLastSeen,
  hasNoActivityFilter,
  withNoActivityFilter,
} from './lastSeen'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
interface EditToolbarProps {
  setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void
  setRowModesModel: (
    newModel: (oldModel: GridRowModesModel) => GridRowModesModel
  ) => void
  isAdmin?: boolean
  showDeleted: boolean
  setShowDeleted: (value: boolean) => void
  noActivityOnly: boolean
  setNoActivityOnly: (value: boolean) => void
}

function EditToolbar(props: EditToolbarProps) {
  const {
    setRows,
    setRowModesModel,
    isAdmin,
    showDeleted,
    setShowDeleted,
    noActivityOnly,
    setNoActivityOnly,
  } = props
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
              checked={noActivityOnly}
              onChange={(e) => setNoActivityOnly(e.target.checked)}
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
          label="No Activity Only"
        />
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
// Placeholder row for the pre-selection state. The one place the empty-role
// cast lives in this file; see EMPTY_USER in constants.ts for the userData
// equivalent.
const EMPTY_USER_ROW: users = {
  userid: '',
  email: '',
  fullname: '',
  role: '' as users['role'],
  assignedfismasystems: [],
}

function validateEmail(email: string) {
  return /^[a-zA-Z0-9._:$!%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/.test(email)
}

export default function UserTable() {
  const apiRef = useGridApiRef()
  const accessibleGrid = useAccessibleGrid()
  const navigate = useNavigate()
  const { userInfo, opdivs } = useContextProp()
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
  const [selectedRow, setSelectedRow] = useState<users | undefined>(
    EMPTY_USER_ROW
  )
  const [showDeleted, setShowDeleted] = useState<boolean>(false)
  // Controlled so the "No Activity Only" toolbar switch can inject/remove an
  // isEmpty filter on last_seen while quick-filter text (which also lives in
  // this model) keeps working. The switch state is DERIVED from the model, so
  // removing the filter via the column filter panel un-checks the switch too.
  // The toggle logic lives in lastSeen.ts (withNoActivityFilter) because the
  // community grid's single-filter-item limit makes it subtle enough to pin
  // with tests.
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] })
  const noActivityOnly = hasNoActivityFilter(filterModel)
  const setNoActivityOnly = (value: boolean) => {
    setFilterModel((prev) => withNoActivityFilter(prev, value))
  }
  const [pendingDeleteRow, setPendingDeleteRow] = useState<users | null>(null)
  const [pendingRestoreRow, setPendingRestoreRow] = useState<users | null>(null)
  const [assignModalUserName, setAssignModalUserName] = useState<string>('')
  const [openOpDivModal, setOpenOpDivModal] = useState<boolean>(false)
  const [opdivModalUserId, setOpDivModalUserId] = useState<GridRowId>('')
  const [opdivModalUserName, setOpDivModalUserName] = useState<string>('')
  // Four views of the shared OpDiv list; see opdivDerivations.ts for what each
  // one is for and who narrows what.
  const opdivCodeMap = useMemo(() => buildOpDivCodeMap(opdivs), [opdivs])
  const opdivLabelMap = useMemo(() => buildOpDivLabelMap(opdivs), [opdivs])
  const allAssignableOpDivs = useMemo(
    () => buildAssignableOpDivs(opdivs, isAdmin),
    [opdivs, isAdmin]
  )
  const opdivOptions = useMemo(
    () => narrowToCallerScope(allAssignableOpDivs, userInfo),
    [allAssignableOpDivs, userInfo]
  )
  // Grants for a newly created row. Existing rows are edited through the
  // grant modal, which refreshes the row on save.
  const grantMutation = useSetUserOpDivs()
  // Global fisma-system metadata for the Assign Systems modal. Fetched once
  // per page load and passed down so the modal doesn't re-fetch on every
  // open. allSystems labels cross-OpDiv orphan assignments; decommSystems
  // adds the "(Decommissioned)" flag for retired-system chips.
  const [allSystems, setAllSystems] = useState<FismaSystemType[]>([])
  const [decommSystems, setDecommSystems] = useState<FismaSystemType[]>([])
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
  // Pull a single user's grants and derived identity_provider and patch both
  // onto the row. Called after the grant modal saves and after a new user is
  // created with grants, since the backend recomputes identity_provider on
  // both and it can flip okta <-> entra. The detail response is the
  // authoritative post-save set: a scoped admin's save omits grants they
  // cannot touch, and the backend keeps those, so the request body is not what
  // the row should show. Each call targets its own row, so a late response
  // can't contaminate a different user.
  const refreshUserRow = (userid: string) => {
    if (!userid) return
    axiosInstance
      .get(apiPaths.users.detail(userid))
      .then((res) => {
        const user = res.data?.data
        setRows((prev) =>
          prev.map((row) =>
            row.userid === userid
              ? {
                  ...row,
                  identity_provider: user?.identity_provider,
                  assignedopdivids: user?.assignedopdivids ?? [],
                }
              : row
          )
        )
      })
      .catch((error) => {
        // The interceptor is already navigating away on a 401; a stale-row
        // warning on top of that is noise.
        if (isAuthHandled(error)) return
        // Non-blocking refresh: keep the row as it is, but say so, since the
        // grants and identity provider on screen may no longer match the save.
        console.error(`Failed to refresh user row for ${userid}`, error)
        notify(ERROR_MESSAGES.refresh, 'warning')
      })
  }
  const handleCloseOpDivModal = () => {
    setOpenOpDivModal(false)
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

        const res = await axiosInstance.post(apiPaths.users.root, body)
        const createdUser = res.data.data
        updatedRow.userid = createdUser.userid

        const opdivIdsToGrant = (newRow.opdivs as number[] | undefined) ?? []
        let grantsFailed = false

        if (opdivIdsToGrant.length > 0) {
          try {
            await grantMutation.mutateAsync({
              userid: createdUser.userid,
              opdivIds: opdivIdsToGrant,
            })
            updatedRow.assignedopdivids = opdivIdsToGrant
            // Backend recomputes identity_provider after OpDiv grants — leave blank
            // until refreshUserRow returns the authoritative value.
            refreshUserRow(createdUser.userid)
          } catch (grantError) {
            if (isAuthHandled(grantError)) {
              apiRef.current.updateRows([
                { userid: curRowUserId, _action: 'delete' },
              ])
              return updatedRow
            }
            grantsFailed = true
            updatedRow.identity_provider = createdUser.identity_provider ?? ''
          }
        } else {
          updatedRow.identity_provider = createdUser.identity_provider ?? ''
        }

        apiRef.current.updateRows([{ userid: curRowUserId, _action: 'delete' }])
        apiRef.current.updateRows([updatedRow])
        setSnackBarSeverity(grantsFailed ? 'warning' : 'success')
        setSnackBarText(
          grantsFailed
            ? 'User created, but OpDiv grants failed. Use Assign OpDivs to retry.'
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
        await axiosInstance.put(apiPaths.users.detail(updatedRow?.userid), {
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
    // Backstop: the row-action icon for the current user is already
    // disabled, but guard the handler in case it's invoked some other
    // way (programmatic call, future refactor wiring a new entry point).
    // Self-delete locks the user out of the app with no recovery path.
    if (target.userid === userInfo.userid) {
      notify("You can't delete your own account.", 'error')
      return
    }
    try {
      await axiosInstance.delete(apiPaths.users.detail(target.userid))
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
      await axiosInstance.put(apiPaths.users.restore(target.userid))
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
    async function load() {
      try {
        const res = await axiosInstance.get(apiPaths.users.root, {
          params: { deleted: showDeleted },
          signal: controller.signal,
        })
        if (res.status !== 200) return
        const data = res.data.data.map((row: users) => ({
          ...row,
          role: row.role.trim(),
        }))
        setRows(data)
        // Grants arrive inline on each list row (assignedopdivids); the OpDivs
        // column reads them straight off the row.
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
    }
  }, [canRead, navigate, showDeleted])

  // Fisma-system metadata for the Assign Systems modal. Fetched once here
  // instead of inside the modal so opening the modal only costs the two
  // per-user reads (assigned + assignable) - not the two global reads
  // (active + decommissioned). Held for as long as the table is mounted,
  // so repeat opens reuse it. Both reads are label sources only, so a
  // failure is non-fatal: the picker still offers the right options and
  // in-scope chips still label from the per-user assignable response.
  useEffect(() => {
    if (!isAdmin) return
    const controller = new AbortController()
    async function loadFismaSystems() {
      const [activeRes, decommRes] = await Promise.allSettled([
        axiosInstance.get<{ data: FismaSystemType[] | null }>(
          apiPaths.fismaSystems.root,
          {
            signal: controller.signal,
          }
        ),
        axiosInstance.get<{ data: FismaSystemType[] | null }>(
          apiPaths.fismaSystems.list(true),
          { signal: controller.signal }
        ),
      ])
      if (controller.signal.aborted) return
      if (activeRes.status === 'fulfilled') {
        setAllSystems(activeRes.value.data.data ?? [])
      } else if (!isAuthHandled(activeRes.reason)) {
        console.error('Fetch active fisma systems failed:', activeRes.reason)
      }
      if (decommRes.status === 'fulfilled') {
        setDecommSystems(decommRes.value.data.data ?? [])
      } else if (!isAuthHandled(decommRes.reason)) {
        console.warn(
          'Fetch decommissioned fisma systems failed; decommissioned assignments will chip without a "(Decommissioned)" suffix until the next refresh:',
          decommRes.reason
        )
      }
    }
    loadFismaSystems()
    return () => {
      controller.abort()
    }
  }, [isAdmin])

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
        const ids: number[] = params.row.assignedopdivids ?? []
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
      field: 'last_seen',
      headerName: 'Last Seen',
      flex: 0.75,
      type: 'dateTime',
      // valueGetter (not just renderCell) so sorting, the isEmpty filter
      // operator, and the toolbar's No Activity switch all see a real
      // Date-or-null instead of the raw ISO string.
      valueGetter: (params) => parseLastSeen(params.row.last_seen),
      // Direction-aware so never-active rows sort last under BOTH asc and
      // desc; see compareLastSeen for how it pre-compensates the grid's
      // negation on desc, and lastSeenSortComparator for the live-direction
      // read (and the TODO for the v7 getSortComparator migration).
      sortComparator: lastSeenSortComparator,
      renderCell: (params) => <LastSeenCell value={params.value ?? null} />,
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

        const isSelf = params.row.userid === userInfo.userid

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
          <Tooltip
            title={isSelf ? "You can't delete your own account" : 'Delete User'}
            key={`tooltip-delete-${params.id}`}
            placement="right-start"
          >
            {/* aria-disabled rather than disabled: the actions cell is a
                role="menu" whose children must all be menu items, and a
                disabled button needs a <span> wrapper for Tooltip to see
                hover events (ui#714). Staying enabled also keeps the control
                focusable, so the reason reaches keyboard users. The ripple and
                the opacity stand in for the disabled styling that goes with
                it, so a click still reads as refused rather than ignored. */}
            <GridActionsCellItem
              key={`delete-${params.id}`}
              icon={<DeleteIcon sx={{ color: isSelf ? 'gray' : 'black' }} />}
              label="Delete"
              onClick={isSelf ? undefined : handleDeleteClick(params.id)}
              color="inherit"
              aria-disabled={isSelf || undefined}
              disableRipple={isSelf}
              sx={isSelf ? { opacity: 0.38, cursor: 'not-allowed' } : undefined}
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
          {...accessibleGrid}
          aria-label="Users"
          rows={rows}
          apiRef={apiRef}
          columns={columns}
          // Cell-level edit gates live in cellEditGuards so they can be tested
          // without the grid. See that file for what each field allows and why.
          isCellEditable={(params) =>
            isUserCellEditable(params.field, params.row, {
              assignableRoles,
              showIdpSelector,
            })
          }
          editMode="row"
          getRowId={(row) => row.userid}
          initialState={{
            sorting: {
              sortModel: [{ field: 'role', sort: 'asc' }],
            },
          }}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
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
              noActivityOnly,
              setNoActivityOnly,
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
        open={openModal}
        handleClose={handleCloseModal}
        userid={userId}
        userName={assignModalUserName}
        allSystems={allSystems}
        decommSystems={decommSystems}
      />
      <OpDivGrantModal
        open={openOpDivModal}
        handleClose={handleCloseOpDivModal}
        userid={opdivModalUserId}
        userName={opdivModalUserName}
        assignableOpDivs={allAssignableOpDivs}
        opdivLabelMap={opdivLabelMap}
        // Scoped callers (every admin except an unscoped write admin) must not
        // silently revoke the target's out-of-scope grants on save, so gate the
        // save-time filter for them. Unscoped write admins (OWNER/HHS_ADMIN)
        // send the grant set as-is. This is the inverse of the backend's
        // unscoped-write branch, the predicate it actually decides on.
        enforceCallerScope={!isUnscopedWriteAdmin(userInfo)}
        // The acting admin's own id. The modal fetches this user's CURRENT
        // grants on open for its scope, rather than reading the session-old
        // userInfo.assignedopdivids, so a mid-session grant change can't
        // silently revoke a target's grant on save.
        callerUserId={userInfo.userid}
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
