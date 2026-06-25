import { useEffect, useMemo, useState } from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/Edit'
import DomainIcon from '@mui/icons-material/Domain'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import RestoreIcon from '@mui/icons-material/RestoreFromTrash'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import {
  GridRowModesModel,
  GridRowModes,
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridEventListener,
  GridRowId,
  GridRowModel,
  GridRenderEditCellParams,
  GridRowEditStopReasons,
  useGridApiContext,
  useGridApiRef,
} from '@mui/x-data-grid'
import {
  FormControlLabel,
  Switch,
  Typography,
  InputBase,
  TextField,
  MenuItem,
} from '@mui/material'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import './UserTable.css'
import axiosInstance from '@/axiosConfig'
import { users, OpDiv } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead,
  isOpDivTier,
  selectableRoles,
  roleLabel,
} from '@/utils/userRoles'
import { fetchOpDivs } from '@/utils/opdivs'
import { fetchUserOpDivs } from '@/utils/userOpdivs'
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
import PageHeader from '@/components/ds/PageHeader'
import { CodeBadge, StatusChip } from '@/components/ds/StatusChip'
import DataGridPaginationFooter from '@/components/ds/DataGridPaginationFooter'
import { colors, radius } from '@/theme/tokens'

/** Initials taken from a full name (or email local-part) - up to 2 letters. */
function initialsFor(fullname: string | undefined, email: string): string {
  const source = (fullname || email.split('@')[0] || '').trim()
  if (!source) return 'U'
  return (
    source
      .split(/\s+|[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  )
}

/**
 * Deterministic avatar background pulled from a small accessible palette,
 * indexed by a stable hash of the userid so each user keeps the same color
 * across renders.
 */
const AVATAR_PALETTE = [
  '#0F2E6E', // ink900
  '#A34200', // down
  '#0F5C4C', // up
  '#663399', // tier traditional
  '#39414E', // neutral700
  '#1B4DAB', // primary
] as const
function avatarColor(userid: string): string {
  let h = 0
  for (let i = 0; i < userid.length; i += 1)
    h = (h * 31 + userid.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

/** Short descriptor shown under the role name (matches the redesign mock). */
const ROLE_DESCRIPTOR: Record<string, string> = {
  OWNER: 'Unscoped - write',
  HHS_ADMIN: 'Unscoped - write',
  HHS_READONLY_ADMIN: 'Unscoped - read',
  OPDIV_ADMIN: 'OpDiv-scoped - write',
  OPDIV_READONLY_ADMIN: 'OpDiv-scoped - read',
  ISSO: 'System-scoped',
  ISSM: 'System-scoped',
  ADMIN: 'Unscoped - write',
  READONLY_ADMIN: 'Unscoped - read',
}

/** Resolves the status pill kind/label from a user record. */
function userStatus(row: { deleted?: boolean; identity_provider?: string }): {
  label: string
  kind: 'active' | 'warning' | 'neutral'
} {
  if (row.deleted) return { label: 'Deactivated', kind: 'neutral' }
  if (!row.identity_provider) return { label: 'Invited', kind: 'warning' }
  return { label: 'Active', kind: 'active' }
}

/** Display label for the identity_provider column. */
function idpLabel(idp: string | undefined): string {
  if (idp === 'okta') return 'Okta'
  if (idp === 'entra') return 'Entra'
  return '-'
}

/**
 * Edit cell for the Name column. Renders the avatar + stacked Name and Email
 * inputs (the email lives in a hidden column, edited here via the grid API so
 * row-edit mode commits both fields together).
 */
function NameEditCell(props: GridRenderEditCellParams) {
  const { id, value, row } = props
  const apiRef = useGridApiContext()
  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    apiRef.current.setEditCellValue({
      id,
      field: 'fullname',
      value: e.target.value,
    })
  }
  const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    apiRef.current.setEditCellValue({
      id,
      field: 'email',
      value: e.target.value,
    })
  }
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        // DataGrid strips its 18px cell padding in edit mode; add it back so
        // the inputs aren't flush against the row's left edge.
        px: 2.25,
        py: 1,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: avatarColor(String(row.userid)),
          color: colors.white,
          fontSize: 12,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initialsFor(row.fullname, row.email)}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          flex: 1,
          minWidth: 0,
        }}
      >
        <InputBase
          // Auto-focus the first input on inline edit (only fires on explicit
          // user-triggered edit mode, matching the previous EditInputCell).
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder="Full name"
          value={value ?? ''}
          onChange={onNameChange}
          sx={{
            fontSize: 13,
            fontWeight: 500,
            height: 28,
            px: 1,
            border: `1px solid ${colors.border}`,
            borderRadius: `${radius.sm}px`,
            backgroundColor: colors.white,
          }}
        />
        <InputBase
          placeholder="Email"
          value={row.email ?? ''}
          onChange={onEmailChange}
          sx={{
            fontSize: 12,
            fontWeight: 500,
            height: 26,
            px: 1,
            border: `1px solid ${colors.border}`,
            borderRadius: `${radius.sm}px`,
            backgroundColor: colors.white,
          }}
        />
      </Box>
    </Box>
  )
}

/**
 * Edit cell for the Role column. Shows the native singleSelect dropdown with
 * the short descriptor underneath, updating live as the user picks a role.
 */
function RoleEditCell({
  options,
  ...props
}: GridRenderEditCellParams & { options: { value: string; label: string }[] }) {
  const { id, value } = props
  const apiRef = useGridApiContext()
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        width: '100%',
        // Match the cell padding the DataGrid strips in edit mode.
        px: 2.25,
        py: 1,
      }}
    >
      <TextField
        select
        size="small"
        value={value ?? ''}
        onChange={(e) =>
          apiRef.current.setEditCellValue({
            id,
            field: 'role',
            value: e.target.value,
          })
        }
        sx={{
          '& .MuiInputBase-root': { height: 30, fontSize: 13 },
          '& .MuiSelect-select': {
            py: 0,
            pl: 1.5,
            display: 'flex',
            alignItems: 'center',
            height: '30px !important',
            boxSizing: 'border-box',
          },
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
      <Typography sx={{ fontSize: 12, color: colors.neutral500, pl: 0.5 }}>
        {ROLE_DESCRIPTOR[value as string] ?? ''}
      </Typography>
    </Box>
  )
}
interface UsersToolbarProps {
  search: string
  setSearch: (value: string) => void
  roleFilter: string | 'all'
  setRoleFilter: (value: string | 'all') => void
  roleOptions: { value: string; label: string }[]
  opdivFilter: number | 'all'
  setOpDivFilter: (value: number | 'all') => void
  opdivOptions: OpDiv[]
  showDeleted: boolean
  setShowDeleted: (value: boolean) => void
}

/**
 * Toolbar inside the Users table card. Mirrors the Dashboard FISMA-systems
 * toolbar: search input, Role and OpDiv filter dropdowns, and a
 * "Show deactivated" toggle, all sharing a uniform 30px row.
 */
function UsersToolbar({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  roleOptions,
  opdivFilter,
  setOpDivFilter,
  opdivOptions,
  showDeleted,
  setShowDeleted,
}: UsersToolbarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'end',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        borderBottom: `1px solid ${colors.neutral200}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          height: 30,
          border: `1px solid ${colors.neutral200}`,
          borderRadius: `${radius.md}px`,
        }}
      >
        <SearchIcon sx={{ fontSize: 14, color: colors.neutral500 }} />
        <InputBase
          placeholder="Search by name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ fontSize: 13, width: 220 }}
          inputProps={{ 'aria-label': 'Search users' }}
        />
      </Box>
      <TextField
        select
        size="small"
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value as string | 'all')}
        sx={{
          minWidth: 110,
          '& .MuiInputBase-root': { height: 30, fontSize: 13 },
          '& .MuiSelect-select': {
            py: 0,
            pl: 1.5,
            display: 'flex',
            alignItems: 'center',
            height: '30px !important',
            boxSizing: 'border-box',
          },
        }}
        aria-label="Filter by role"
      >
        <MenuItem value="all">Role</MenuItem>
        {roleOptions.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        value={opdivFilter}
        onChange={(e) =>
          setOpDivFilter(
            e.target.value === 'all' ? 'all' : Number(e.target.value)
          )
        }
        sx={{
          minWidth: 110,
          '& .MuiInputBase-root': { height: 30, fontSize: 13 },
          '& .MuiSelect-select': {
            py: 0,
            pl: 1.5,
            display: 'flex',
            alignItems: 'center',
            height: '30px !important',
            boxSizing: 'border-box',
          },
        }}
        aria-label="Filter by OpDiv"
      >
        <MenuItem value="all">OpDiv</MenuItem>
        {opdivOptions.map((od) => (
          <MenuItem key={od.opdiv_id} value={od.opdiv_id}>
            {od.code}
          </MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        sx={{
          marginLeft: 'auto',
          m: 0,
          height: 30,
          '& .MuiSwitch-root': { padding: 0, width: 32, height: 18, mr: 1 },
          '& .MuiSwitch-switchBase': { padding: 0.25 },
          '& .MuiSwitch-thumb': { width: 14, height: 14 },
          '& .MuiSwitch-track': { borderRadius: 999 },
        }}
        control={
          <Switch
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
        }
        label={<Typography sx={{ fontSize: 13 }}>Show deactivated</Typography>}
      />
    </Box>
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
  // Toolbar filter state. Search applies as a controlled quick-filter on the
  // DataGrid; role and OpDiv narrow the row set client-side so the existing
  // /users response shape stays unchanged.
  const [search, setSearch] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all')
  const [opdivFilter, setOpDivFilter] = useState<number | 'all'>('all')
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
  /**
   * Add an empty row to the grid and immediately open it in edit mode, focused
   * on the name field. Mirrors the previous in-toolbar Add User flow but is
   * now triggered from the page header's primary button.
   */
  const addUserRow = () => {
    const userid = String(Math.floor(Math.random() * 1000) + 1)
    setRows((oldRows) => [
      ...oldRows,
      {
        userid,
        fullname: '',
        email: '',
        role: '' as users['role'],
        assignedfismasystems: [],
        isNew: true,
      } as users,
    ])
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [userid]: { mode: GridRowModes.Edit, fieldToFocus: 'fullname' },
    }))
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
        const res = await axiosInstance.post('/users', {
          email: updatedRow.email,
          fullname: updatedRow.fullname,
          role: updatedRow.role,
        })
        newRow = res.data.data
        updatedRow.userid = newRow.userid
        apiRef.current.updateRows([{ userid: curRowUserId, _action: 'delete' }])
        apiRef.current.updateRows([updatedRow])
        setSnackBarSeverity('success')
        setSnackBarText(STATUS_MESSAGES.saved)
        setOpen(true)
      } catch (error) {
        if (isAuthHandled(error)) return updatedRow
        console.error('Error updating score:', error)
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
      headerName: 'Name',
      flex: 1.6,
      minWidth: 220,
      hideable: false,
      // Custom edit cell stacks the email input below the name input next to
      // the avatar, matching the redesign inline-edit mock.
      renderEditCell: (params: GridRenderEditCellParams) => (
        <NameEditCell {...params} />
      ),
      editable: isAdmin,
      // Avatar + name + email stacked, matching the redesign.
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              flexShrink: 0,
              backgroundColor: avatarColor(String(params.row.userid)),
              color: colors.white,
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {initialsFor(params.row.fullname, params.row.email)}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: 14,
                color: colors.ink,
                lineHeight: 1.3,
              }}
            >
              {params.row.fullname || '-'}
            </Typography>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 500,
                color: colors.neutral500,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {params.row.email}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      // Email lives inside the Name cell; keep the column for inline-edit
      // wiring but hide it from view.
      flex: 0,
      width: 0,
      minWidth: 0,
      hideable: true,
      filterable: false,
      sortable: false,
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
      renderCell: () => null,
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 1.4,
      minWidth: 180,
      editable: isAdmin,
      // Native DataGrid dropdown, scoped to the roles this admin may assign.
      // Options carry the raw enum as the stored value and a humanized label
      // for display, so the table never surfaces a database constant.
      type: 'singleSelect',
      valueOptions: assignableRoles.map((r) => ({
        value: r,
        label: roleLabel(r),
      })),
      renderCell: (params) =>
        params.row.role ? (
          <Box>
            <Typography
              sx={{ fontWeight: 600, fontSize: 14, color: colors.ink }}
            >
              {roleLabel(params.row.role)}
            </Typography>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 500,
                color: colors.neutral500,
                mt: 0.25,
              }}
            >
              {ROLE_DESCRIPTOR[params.row.role] ?? ''}
            </Typography>
          </Box>
        ) : null,
      // Custom edit cell adds the live descriptor under the dropdown so the
      // inline edit row mirrors the read view's stacked layout.
      renderEditCell: (params: GridRenderEditCellParams) => (
        <RoleEditCell
          {...params}
          options={assignableRoles.map((r) => ({
            value: r,
            label: roleLabel(r),
          }))}
        />
      ),
    },
    {
      field: 'opdivs',
      headerName: 'OpDivs',
      flex: 1.4,
      minWidth: 160,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        // Refresh override (post grant-modal) wins; otherwise use the grants the
        // list returned inline on the row.
        const ids =
          userOpDivMap[params.row.userid] ?? params.row.assignedopdivids ?? []
        if (!ids.length) {
          return (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          )
        }
        // Show first 2 codes inline; collapse the rest into a "+N" muted chip
        // so the row stays at a uniform height when a user has many grants.
        const visible = ids.slice(0, 2)
        const overflow = ids.length - visible.length
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {visible.map((id) => (
              <CodeBadge key={id} code={String(opdivCodeMap[id] ?? id)} />
            ))}
            {overflow > 0 && <CodeBadge code={`+${overflow}`} muted />}
          </Box>
        )
      },
    },
    {
      field: 'identity_provider',
      headerName: 'Identity provider',
      flex: 1,
      minWidth: 130,
      editable: false,
      // Display-only with a proper-noun cased label and a small dot in front,
      // matching the design's "● Okta / ● Entra" pattern. The backend derives
      // this from the user's OpDiv (OWNER-only override server-side).
      valueGetter: (params) => idpLabel(params.row.identity_provider),
      renderCell: (params) => {
        const idp = params.row.identity_provider
        if (!idp) {
          return (
            <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
              -
            </Typography>
          )
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: colors.primary,
              }}
            />
            <Typography sx={{ fontSize: 13, color: colors.ink }}>
              {idpLabel(idp)}
            </Typography>
          </Box>
        )
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.9,
      minWidth: 110,
      sortable: false,
      filterable: false,
      valueGetter: (params) => userStatus(params.row).label,
      renderCell: (params) => {
        const { label, kind } = userStatus(params.row)
        return <StatusChip label={label} kind={kind} />
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      headerAlign: 'right',
      align: 'right',
      // Wide enough to fit either "Save" + "Cancel" text buttons in edit mode
      // or the edit-icon + kebab pair in read mode without clipping.
      width: 170,
      sortable: false,
      filterable: false,
      cellClassName: 'actions',
      getActions: (params) => {
        // Read-only admins see the table but no mutating controls.
        if (!isAdmin) return []
        const isInEditMode =
          rowModesModel[params.id]?.mode === GridRowModes.Edit
        if (isInEditMode) {
          // Text buttons (Save filled, Cancel outline) matching the redesign
          // mock - the default floppy + X icons read as too small for an
          // inline-edit save/cancel action.
          return [
            <Button
              key={`save-${params.id}`}
              variant="contained"
              color="primary"
              size="small"
              sx={{ minHeight: 28, py: 0.25, px: 1.5, fontSize: 13 }}
              onClick={handleSaveClick(params.id)}
            >
              Save
            </Button>,
            <Button
              key={`cancel-${params.id}`}
              variant="outlined"
              size="small"
              sx={{
                minHeight: 28,
                py: 0.25,
                px: 1.5,
                fontSize: 13,
                color: colors.neutral700,
                borderColor: colors.neutral200,
              }}
              onClick={handleCancelClick(params.id)}
            >
              Cancel
            </Button>,
          ] as React.ReactElement[]
        }

        // Mirror the backend CanManageUser rule: an admin can only manage a
        // user whose role is within their assignable tier (the list is already
        // OpDiv-scoped server-side). Withhold edit/assign/delete/restore for
        // out-of-tier targets so they don't hit a 403. New rows (blank role,
        // mid-create) are handled by the edit-mode branch above.
        if (!assignableRoles.includes(params.row.role)) return []

        if (params.row.deleted) {
          return [
            <GridActionsCellItem
              icon={
                <RestoreIcon
                  fontSize="small"
                  sx={{ color: colors.neutral700 }}
                />
              }
              key={`restore-${params.id}`}
              label="Restore user"
              showInMenu={false}
              onClick={handleRestoreClick(params.id)}
              color="inherit"
            />,
          ]
        }

        // Active / Invited rows: Edit (icon) + a kebab menu with the assign /
        // delete actions. Match the Dashboard row actions: fontSize="small"
        // (~20px), neutral700 color so both tables read identically.
        return [
          <GridActionsCellItem
            icon={
              <EditIcon fontSize="small" sx={{ color: colors.neutral700 }} />
            }
            key={`edit-${params.id}`}
            label="Edit user"
            onClick={handleEditClick(params.id)}
            color="inherit"
          />,
          <GridActionsCellItem
            icon={
              <MoreHorizIcon
                fontSize="small"
                sx={{ color: colors.neutral700 }}
              />
            }
            key={`assign-${params.id}`}
            label="Assign FISMA systems"
            showInMenu
            onClick={() => handleOpenModal(params.id)}
          />,
          <GridActionsCellItem
            key={`assign-opdivs-${params.id}`}
            icon={
              <DomainIcon fontSize="small" sx={{ color: colors.neutral700 }} />
            }
            label="Assign OpDivs"
            showInMenu
            onClick={() => handleOpenOpDivModal(params.id)}
          />,
          <GridActionsCellItem
            key={`delete-${params.id}`}
            icon={
              <DeleteIcon fontSize="small" sx={{ color: colors.neutral700 }} />
            }
            label="Delete user"
            showInMenu
            onClick={handleDeleteClick(params.id)}
          />,
        ]
      },
    },
  ]

  // Subtitle counts for the page header.
  const activeCount = rows.filter(
    (r) => !r.deleted && r.identity_provider
  ).length
  const invitedCount = rows.filter(
    (r) => !r.deleted && !r.identity_provider
  ).length
  const subtitleParts: string[] = []
  if (activeCount > 0)
    subtitleParts.push(
      `${activeCount} active ${activeCount === 1 ? 'user' : 'users'}`
    )
  if (invitedCount > 0)
    subtitleParts.push(
      `${invitedCount} pending invitation${invitedCount === 1 ? '' : 's'}`
    )
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : ''

  // Role dropdown options derive from the roles currently present in the row
  // set, humanized via roleLabel. Restricting to actual roles keeps the
  // dropdown short and meaningful (no empty "no users with this role" picks).
  const roleOptions = useMemo(() => {
    const present = Array.from(
      new Set(rows.map((r) => r.role).filter(Boolean))
    ) as string[]
    return present.sort().map((r) => ({ value: r, label: roleLabel(r) }))
  }, [rows])

  // Client-side filtered rows. Search is forwarded as quickFilterValues to the
  // DataGrid (so it gets per-column matching for free); role + opdiv narrow
  // the row set itself.
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (opdivFilter !== 'all') {
        const ids =
          userOpDivMap[row.userid] ?? row.assignedopdivids ?? ([] as number[])
        if (!ids.includes(opdivFilter)) return false
      }
      return true
    })
  }, [rows, roleFilter, opdivFilter, userOpDivMap])

  const quickFilterValues = search.trim()
    ? search.trim().split(/\s+/)
    : undefined

  return (
    <Box
      sx={{
        pt: 3,
        pb: 4,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <PageHeader
        title="Users"
        subtitle={subtitle || undefined}
        breadcrumbs={<BreadCrumbs />}
        actions={
          isAdmin ? (
            <>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<EmailOutlinedIcon />}
                onClick={() => {
                  /* email-users entry lives in the avatar menu; future hook */
                }}
                disabled
              >
                Email users
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={addUserRow}
                disabled={showDeleted}
              >
                Add user
              </Button>
            </>
          ) : undefined
        }
      />
      <Box
        sx={{
          backgroundColor: colors.white,
          border: `1px solid ${colors.neutral200}`,
          borderRadius: `${radius.card}px`,
          overflow: 'hidden',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          '& .actions': { color: 'text.secondary' },
          '& .textPrimary': { color: 'text.primary' },
        }}
      >
        <UsersToolbar
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          roleOptions={roleOptions}
          opdivFilter={opdivFilter}
          setOpDivFilter={setOpDivFilter}
          opdivOptions={opdivOptions}
          showDeleted={showDeleted}
          setShowDeleted={setShowDeleted}
        />
        <Box sx={{ flex: 1, minHeight: 0, width: '100%', display: 'flex' }}>
          <DataGrid
            aria-label="Users"
            rows={filteredRows}
            apiRef={apiRef}
            columns={columns}
            // Editing rows grow taller so the stacked Name/Email inputs and
            // the role descriptor have breathing room above and below.
            getRowHeight={(params) =>
              rowModesModel[params.id]?.mode === GridRowModes.Edit ? 88 : 64
            }
            getRowClassName={(params) =>
              rowModesModel[params.id]?.mode === GridRowModes.Edit
                ? 'is-editing-row'
                : ''
            }
            columnVisibilityModel={{ email: false }}
            filterModel={{ items: [], quickFilterValues }}
            // Don't let an admin edit a role they can't assign: if a row's
            // current role is above this admin's tier, lock the role cell so it
            // can't be blanked or downgraded on save. New rows (blank role,
            // mid-create) stay editable - valueOptions already limits the choices
            // to the admin's assignable set. The server enforces this too.
            isCellEditable={(params) =>
              params.field !== 'role' ||
              params.row.isNew ||
              !params.row.role ||
              assignableRoles.includes(params.row.role)
            }
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
            slots={{ footer: DataGridPaginationFooter }}
            pageSizeOptions={[25, 50, 100]}
            disableColumnSelector
            disableRowSelectionOnClick
            sx={{
              flex: 1,
              minHeight: 0,
              border: 'none',
              backgroundColor: colors.white,
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: colors.neutral50,
              },
              '& .MuiDataGrid-cell': {
                borderBottom: `1px solid ${colors.neutral100}`,
              },
              // Inline-edit row highlight: faint primary50 background + 3px
              // primary left accent stripe, matching the redesign mock.
              '& .MuiDataGrid-row.is-editing-row': {
                backgroundColor: colors.surfaceAlt,
                boxShadow: `inset 3px 0 0 0 ${colors.primary}`,
              },
              '& .MuiTablePagination-selectLabel': { mb: 2 },
              '& .MuiTablePagination-displayedRows': { mb: 2 },
            }}
          />
        </Box>
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
    </Box>
  )
}
