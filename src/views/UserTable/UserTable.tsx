import { useEffect, useMemo, useState } from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import RestoreIcon from '@mui/icons-material/RestoreFromTrash'
import {
  GridRowModesModel,
  GridRowModes,
  DataGrid,
  GridColDef,
  GridEventListener,
  GridRowId,
  GridRowModel,
  GridRenderEditCellParams,
  GridRowEditStopReasons,
  useGridApiRef,
} from '@mui/x-data-grid'
import { Typography, IconButton, Tooltip } from '@mui/material'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import './UserTable.css'
import axiosInstance from '@/axiosConfig'
import { users } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead,
  hasUnscopedRead,
  isUnscopedWriteAdmin,
  selectableRoles,
  roleLabel,
} from '@/utils/userRoles'
import { fetchUserOpDivs, setUserOpDivs } from '@/utils/userOpdivs'
import CONFIG from '@/utils/config'
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
import PageHeader from '@/components/ui/PageHeader'
import { CodeBadge, StatusChip } from '@/components/ui/StatusChip'
import DataGridPaginationFooter from '@/components/ui/DataGridPaginationFooter'
import { colors, radius } from '@/theme/tokens'
import {
  avatarColor,
  idpLabel,
  initialsFor,
  ROLE_DESCRIPTOR,
  userStatus,
  validateEmail,
} from './helpers'
import NameEditCell from './cells/NameEditCell'
import OpDivsEditCell from './cells/OpDivsEditCell'
import IdpEditCell from './cells/IdpEditCell'
import RoleEditCell from './cells/RoleEditCell'
import UsersToolbar from './components/UsersToolbar'
import ActionsCell from './components/ActionsCell'
import { useUserFilters } from './hooks/useUserFilters'
import { useOpDivCatalog } from './hooks/useOpDivCatalog'
import { useUsersSnackbar } from './hooks/useUsersSnackbar'
import { useUsersModals } from './hooks/useUsersModals'
import { useLoadUsers } from './hooks/useLoadUsers'
import { useSystemCatalog } from './hooks/useSystemCatalog'

export default function UserTable() {
  const apiRef = useGridApiRef()
  const navigate = useNavigate()
  const { userInfo } = useContextProp()
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
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({})
  const snackbar = useUsersSnackbar()
  const modals = useUsersModals()
  const [selectedRow, setSelectedRow] = useState<users | undefined>({
    userid: '',
    email: '',
    fullname: '',
    role: '' as users['role'],
    assignedfismasystems: [],
  })
  const {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    opdivFilter,
    setOpDivFilter,
    showDeleted,
    setShowDeleted,
    quickFilterValues,
  } = useUserFilters()
  const { opdivOptions, opdivCodeMap, opdivLabelMap } = useOpDivCatalog(
    isAdmin,
    userInfo
  )
  // Global fisma-system metadata for the Assign Systems modal - fetched once
  // per mount so opening the modal only costs its two per-user reads.
  const { allSystems, decommSystems } = useSystemCatalog(isAdmin)
  const { rows, setRows, userOpDivMap, setUserOpDivMap } = useLoadUsers({
    canRead,
    showDeleted,
  })
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
      snackbar.show(errMessage, 'error')
      setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } })
    } else {
      setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } })
    }
  }
  const handleOpenModal = (id: GridRowId) => {
    const row = rows.find((r) => r.userid === id)
    if (row) modals.openAssign(row)
  }
  const handleOpenOpDivModal = (id: GridRowId) => {
    const row = rows.find((r) => r.userid === id)
    if (row) modals.openOpDiv(row)
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
    const targetId = String(modals.opdiv.userid)
    modals.closeOpDiv()
    refreshUserRow(targetId)
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
        let grantsFailed = false

        if (opdivIdsToGrant.length > 0) {
          try {
            await setUserOpDivs(createdUser.userid, opdivIdsToGrant)
            setUserOpDivMap((prev) => ({
              ...prev,
              [createdUser.userid]: opdivIdsToGrant,
            }))
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
        snackbar.show(
          grantsFailed
            ? 'User created, but OpDiv grants failed. Use Assign OpDivs to retry.'
            : STATUS_MESSAGES.saved,
          grantsFailed ? 'warning' : 'success'
        )
      } catch (error) {
        if (isAuthHandled(error)) return updatedRow
        console.error('Error creating user:', error)
        snackbar.showSaveError(error)
      }
    } else {
      try {
        // identity_provider is intentionally absent: for existing rows the
        // backend derives it from OpDiv membership, so the row PUT only
        // carries the profile fields.
        await axiosInstance.put(`/users/${updatedRow?.userid}`, {
          email: updatedRow?.email,
          fullname: updatedRow?.fullname,
          role: updatedRow?.role,
        })
        snackbar.show(STATUS_MESSAGES.saved, 'success')
      } catch (error) {
        if (isAuthHandled(error)) return updatedRow
        console.error('Error saving user:', error)
        snackbar.showSaveError(error)
      }
    }
    setRows(rows.map((row) => (row.userid === curRowUserId ? updatedRow : row)))
    return updatedRow
  }
  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel)
  }
  const handleProcessRowUpdateError = () => {
    snackbar.show('An error occurred while saving the row', 'error')
  }
  const handleDeleteClick = (id: GridRowId) => () => {
    const curRow = apiRef.current.getRow(id) as users | undefined
    if (!curRow) return
    modals.askDelete(curRow)
  }
  const handleConfirmDelete = async (confirm: boolean) => {
    const target = modals.pendingDelete
    modals.clearDelete()
    if (!confirm || !target) return
    // Backstop: the row-action icon for the current user is already
    // disabled, but guard the handler in case it's invoked some other
    // way (programmatic call, future refactor wiring a new entry point).
    // Self-delete locks the user out of the app with no recovery path.
    if (String(target.userid) === String(userInfo.userid)) {
      notify("You can't delete your own account.", 'error')
      return
    }
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
    modals.askRestore(curRow)
  }
  const handleConfirmRestore = async (confirm: boolean) => {
    const target = modals.pendingRestore
    modals.clearRestore()
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
          {/* Initials avatar is decorative - the full name renders next to
              it, so hide it from screen readers to avoid a stray "LO". */}
          <Box
            aria-hidden="true"
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
      // Editable only on new rows (see isCellEditable): the edit cell
      // builds the row-local `opdivs` set that processRowUpdate batch-grants
      // after the user is created. Existing rows manage grants through the
      // Assign OpDivs modal.
      editable: isAdmin,
      renderEditCell: (params) => (
        <OpDivsEditCell
          {...params}
          opdivOptions={opdivOptions}
          opdivCodeMap={opdivCodeMap}
        />
      ),
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
        // The overflow chip gets a tooltip listing the hidden codes so the
        // information is not lost at a glance.
        const visible = ids.slice(0, 2)
        const hidden = ids.slice(2)
        const overflow = hidden.length
        const hiddenCodes = hidden.map((id) => String(opdivCodeMap[id] ?? id))
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {visible.map((id) => (
              <CodeBadge key={id} code={String(opdivCodeMap[id] ?? id)} />
            ))}
            {overflow > 0 && (
              <Tooltip title={hiddenCodes.join(', ')}>
                <Box component="span" sx={{ display: 'inline-flex' }}>
                  <CodeBadge code={`+${overflow}`} muted />
                </Box>
              </Tooltip>
            )}
          </Box>
        )
      },
    },
    {
      field: 'identity_provider',
      headerName: 'Identity provider',
      flex: 1,
      minWidth: 140,
      // Editable only for HHS-wide admins when the IdP feature flag is on,
      // and effectively only meaningful on new rows: for existing rows the
      // backend derives identity_provider from OpDiv membership. Read view
      // stays as the dot + label pattern.
      editable: showIdpSelector,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <IdpEditCell {...params} />
      ),
      // No valueGetter: the inline IdP Select binds to the raw lowercase value
      // ('okta'/'entra') and a valueGetter returning the display label would
      // make MUI's edit state seed 'Okta'/'Entra' instead, which would never
      // match the MenuItem values and the Select would render empty.
      // valueFormatter is fine for sort/quick-filter display, but renderCell
      // already handles display so neither is needed here.
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
      headerName: 'Actions',
      headerAlign: 'right',
      align: 'right',
      // Wide enough to fit either "Save" + "Cancel" text buttons in edit mode
      // or the edit-icon + kebab pair in read mode without clipping.
      width: 170,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        // Read-only admins see the table but no mutating controls.
        if (!isAdmin) return null
        const isInEditMode =
          rowModesModel[params.id]?.mode === GridRowModes.Edit
        if (isInEditMode) {
          // Text buttons (Save filled, Cancel outline) matching the redesign
          // mock - the default floppy + X icons read as too small for an
          // inline-edit save/cancel action.
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
                width: '100%',
              }}
            >
              <Button
                variant="contained"
                color="primary"
                size="small"
                sx={{ minHeight: 28, py: 0.25, px: 1.5, fontSize: 13 }}
                onClick={handleSaveClick(params.id)}
              >
                Save
              </Button>
              <Button
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
              </Button>
            </Box>
          )
        }

        // Mirror the backend CanManageUser rule: an admin can only manage a
        // user whose role is within their assignable tier (the list is already
        // OpDiv-scoped server-side). Withhold edit/assign/delete/restore for
        // out-of-tier targets so they don't hit a 403. New rows (blank role,
        // mid-create) are handled by the edit-mode branch above.
        if (!assignableRoles.includes(params.row.role)) return null

        if (params.row.deleted) {
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                width: '100%',
              }}
            >
              <Tooltip title="Restore user">
                <IconButton
                  size="small"
                  onClick={handleRestoreClick(params.id)}
                  aria-label="Restore user"
                >
                  <RestoreIcon
                    fontSize="small"
                    sx={{ color: colors.neutral700 }}
                  />
                </IconButton>
              </Tooltip>
            </Box>
          )
        }

        // Active / Invited rows: Edit (icon) + a kebab menu with the assign /
        // delete actions. Every icon button is wrapped in a Tooltip so hover
        // labels match the rest of the redesign.
        return (
          <ActionsCell
            onEdit={handleEditClick(params.id)}
            onAssignSystems={() => handleOpenModal(params.id)}
            onAssignOpDivs={() => handleOpenOpDivModal(params.id)}
            onDelete={handleDeleteClick(params.id)}
            isSelf={String(params.row.userid) === String(userInfo.userid)}
          />
        )
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

  return (
    <Box
      sx={{
        pt: 3,
        pb: 4,
        // Natural document flow: the grid renders at its full height
        // (autoHeight) and the page scrolls, pushing the CMS footer down.
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
        {/* Fixed grid height (parity with main): rows scroll inside the
            grid while the page scrolls around the card. */}
        <Box sx={{ height: 600, width: '100%' }}>
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
            // Cell-level edit gates (defense-in-depth; server enforces the
            // same rules):
            // - role: locked on existing rows whose current role is outside
            //   this admin's assignable tier.
            // - opdivs / identity_provider: locked to new rows only -
            //   existing users' OpDiv memberships and derived IdP are
            //   managed via the Assign OpDivs action, not inline editing.
            isCellEditable={(params) => {
              if (params.field === 'role') {
                return (
                  params.row.isNew ||
                  !params.row.role ||
                  assignableRoles.includes(params.row.role)
                )
              }
              if (params.field === 'opdivs') {
                return !!params.row.isNew
              }
              if (params.field === 'identity_provider') {
                return !!params.row.isNew && showIdpSelector
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
            slots={{ footer: DataGridPaginationFooter }}
            pageSizeOptions={[25, 50, 100]}
            disableColumnSelector
            // Table has its own search + filters in the toolbar; hide every
            // per-column 3-dot menu (its filter popup overlaps with the CMS
            // DSG global stylesheet too).
            disableColumnMenu
            disableRowSelectionOnClick
            sx={{
              height: '100%',
              border: 'none',
              backgroundColor: colors.white,
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: colors.neutral50,
              },
              '& .MuiDataGrid-cell': {
                borderBottom: `1px solid ${colors.neutral100}`,
              },
              // Inline-edit row highlight: faint primary50 background + 3px
              // primary left accent stripe, matching the redesign mock. The
              // background applies to every cell in the row so it shows
              // through the DataGrid's cell layer; the stripe sits on the
              // row's first cell so it isn't clipped by the row's overflow.
              '& .MuiDataGrid-row.is-editing-row, & .MuiDataGrid-row.is-editing-row .MuiDataGrid-cell':
                {
                  backgroundColor: colors.surfaceAlt,
                },
              '& .MuiDataGrid-row.is-editing-row .MuiDataGrid-cell:first-of-type':
                {
                  borderLeft: `3px solid ${colors.primary}`,
                },
              '& .MuiTablePagination-selectLabel': { mb: 2 },
              '& .MuiTablePagination-displayedRows': { mb: 2 },
            }}
          />
        </Box>
      </Box>
      <CustomSnackbar
        open={snackbar.open}
        handleClose={snackbar.close}
        duration={2000}
        severity={snackbar.severity}
        text={snackbar.text}
      />
      <AssignSystemModal
        open={modals.assign.open}
        handleClose={modals.closeAssign}
        userid={modals.assign.userid}
        userName={modals.assign.userName}
        allSystems={allSystems}
        decommSystems={decommSystems}
      />
      <OpDivGrantModal
        open={modals.opdiv.open}
        handleClose={handleCloseOpDivModal}
        userid={modals.opdiv.userid}
        userName={modals.opdiv.userName}
        opdivOptions={opdivOptions}
        opdivLabelMap={opdivLabelMap}
        // Scoped callers (every admin except an unscoped write admin) must not
        // silently revoke the target's out-of-scope grants on save, so gate the
        // save-time filter for them. Unscoped write admins (OWNER/HHS_ADMIN)
        // send the grant set as-is. This is the inverse of the backend's
        // unscoped-write branch, the predicate it actually decides on.
        enforceCallerScope={!isUnscopedWriteAdmin(userInfo)}
        // The caller's RAW grants (unfiltered by parent/active) - the save-time
        // preserve boundary. Wider than opdivOptions so a caller-held grant to a
        // since re-parented/deactivated OpDiv is preserved, not silently revoked.
        callerGrantIds={userInfo.assignedopdivids ?? []}
        onChanged={refreshUserRow}
      />
      <ConfirmDialog
        title="Confirm User Deletion"
        confirmationText={
          modals.pendingDelete
            ? `Are you sure you want to delete ${modals.pendingDelete.fullname}? This will remove their access to ZTMF. The user can be restored later from the "Show Deleted" view.`
            : ''
        }
        open={modals.pendingDelete !== null}
        onClose={modals.clearDelete}
        confirmClick={handleConfirmDelete}
        confirmLabel="Delete"
      />
      <ConfirmDialog
        title="Confirm User Restore"
        confirmationText={
          modals.pendingRestore
            ? `Restore ${modals.pendingRestore.fullname}? This will re-enable their access to ZTMF.`
            : ''
        }
        open={modals.pendingRestore !== null}
        onClose={modals.clearRestore}
        confirmClick={handleConfirmRestore}
        confirmLabel="Restore"
      />
    </Box>
  )
}
