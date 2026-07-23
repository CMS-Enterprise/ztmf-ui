import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'
import RestoreIcon from '@mui/icons-material/RestoreFromTrash'
import Tooltip from '@mui/material/Tooltip'
import {
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import CustomDialogTitle from '@/components/DialogTitle/CustomDialogTitle'
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { useContextProp } from '../Title/Context'
import { Routes } from '@/router/constants'
import {
  createOpDiv,
  fetchOpDivs,
  updateOpDiv,
  type OpDivInput,
} from '@/utils/opdivs'
import { setOpDivDelegateEnabled } from '@/utils/delegates'
import { isUnscopedWriteAdmin } from '@/utils/userRoles'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import type { OpDiv } from '@/types'

const CODE_MAX = 16
const NAME_MAX = 128

type FormState = { code: string; name: string; is_parent: boolean }
const EMPTY_FORM: FormState = { code: '', name: '', is_parent: false }

function CreateToolbar({
  onCreate,
  canCreate,
}: {
  onCreate: () => void
  canCreate: boolean
}) {
  return (
    <GridToolbarContainer sx={{ justifyContent: 'space-between' }}>
      <GridToolbarQuickFilter debounceMs={250} />
      {canCreate && (
        <Button
          color="primary"
          startIcon={<AddIcon />}
          onClick={onCreate}
          sx={{ color: '#5666b8' }}
        >
          Create OpDiv
        </Button>
      )}
    </GridToolbarContainer>
  )
}

export default function OpDivAdmin() {
  const navigate = useNavigate()
  const { userInfo } = useContextProp()
  // OWNER manages OpDivs fully (create / edit / activate). HHS admin reaches
  // the page only to flip the per-OpDiv System Delegate toggle - every other
  // control stays OWNER-only. The backend enforces both boundaries (OpDiv
  // CRUD is OWNER-only; the delegate-toggle endpoint is OWNER + HHS admin).
  const isOwner = userInfo.role === 'OWNER'
  const canAccess = isUnscopedWriteAdmin(userInfo)
  const canManage = isOwner
  const canToggleDelegate = canAccess

  const [rows, setRows] = useState<OpDiv[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OpDiv | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pendingToggle, setPendingToggle] = useState<OpDiv | null>(null)
  const [pendingDelegateToggle, setPendingDelegateToggle] =
    useState<OpDiv | null>(null)

  // Unscoped write admins (OWNER + HHS admin) reach the page; everyone else is
  // bounced, mirroring the redirect guard UserTable uses. The backend also
  // returns 403 on any mutation the caller isn't allowed to make.
  useEffect(() => {
    if (userInfo.role && !canAccess) {
      navigate(Routes.ROOT, { replace: true })
    }
  }, [userInfo.role, canAccess, navigate])

  const loadOpDivs = useCallback(() => {
    fetchOpDivs(true)
      .then(setRows)
      .catch((error) => {
        if (isAuthHandled(error)) return
        const parsed = parseApiError(error)
        notify(parsed.message, 'error')
      })
  }, [])

  useEffect(() => {
    if (canAccess) loadOpDivs()
  }, [canAccess, loadOpDivs])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const openEdit = (row: OpDiv) => {
    setEditing(row)
    setForm({ code: row.code, name: row.name, is_parent: row.is_parent })
    setFieldErrors({})
    setDialogOpen(true)
  }

  const closeDialog = () => setDialogOpen(false)

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    const code = form.code.trim()
    const name = form.name.trim()
    if (!code || code.length > CODE_MAX)
      errors.code = `1-${CODE_MAX} characters required`
    if (!name || name.length > NAME_MAX)
      errors.name = `1-${NAME_MAX} characters required`
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const input: OpDivInput = {
      code: form.code.trim(),
      name: form.name.trim(),
      is_parent: form.is_parent,
    }
    const request = editing
      ? updateOpDiv(editing.opdiv_id, { ...input, active: editing.active })
      : createOpDiv(input)
    request
      .then(() => {
        notify(
          editing ? 'Saved - OpDiv updated' : 'Saved - OpDiv created',
          'success'
        )
        setDialogOpen(false)
        loadOpDivs()
      })
      .catch((error) => {
        if (isAuthHandled(error)) return
        const parsed = parseApiError(error)
        if (parsed.fieldErrors) {
          // Surface backend field-level validation inline (e.g. duplicate code).
          setFieldErrors(parsed.fieldErrors)
          return
        }
        notify(parsed.message, 'error')
      })
  }

  const handleConfirmToggle = (confirm: boolean) => {
    const target = pendingToggle
    setPendingToggle(null)
    if (!confirm || !target) return
    updateOpDiv(target.opdiv_id, {
      code: target.code,
      name: target.name,
      is_parent: target.is_parent,
      active: !target.active,
    })
      .then(() => {
        notify(
          target.active
            ? 'Saved - OpDiv deactivated'
            : 'Saved - OpDiv activated',
          'success'
        )
        loadOpDivs()
      })
      .catch((error) => {
        if (isAuthHandled(error)) return
        const parsed = parseApiError(error)
        notify(parsed.message, 'error')
      })
  }

  const handleConfirmDelegateToggle = (confirm: boolean) => {
    const target = pendingDelegateToggle
    setPendingDelegateToggle(null)
    if (!confirm || !target) return
    setOpDivDelegateEnabled(target.opdiv_id, !target.system_delegate_enabled)
      .then(() => {
        notify(
          target.system_delegate_enabled
            ? 'Saved - System Delegate disabled'
            : 'Saved - System Delegate enabled',
          'success'
        )
        loadOpDivs()
      })
      .catch((error) => {
        if (isAuthHandled(error)) return
        const parsed = parseApiError(error)
        notify(parsed.message, 'error')
      })
  }

  const columns: GridColDef[] = useMemo(() => {
    const cols: GridColDef[] = [
      { field: 'code', headerName: 'Code', flex: 0.6 },
      { field: 'name', headerName: 'Name', flex: 1.4 },
      {
        field: 'is_parent',
        headerName: 'Parent',
        flex: 0.4,
        valueGetter: (params) => (params.row.is_parent ? 'Yes' : 'No'),
      },
      {
        field: 'active',
        headerName: 'Status',
        flex: 0.5,
        valueGetter: (params) => (params.row.active ? 'Active' : 'Inactive'),
      },
      {
        field: 'system_delegate_enabled',
        // Short visible header; the full spec label "Add System Delegate Role"
        // rides along as the header tooltip (description) and the switch's
        // aria-label, so it fits the grid without losing the exact wording.
        headerName: 'System Delegate',
        description: 'Add System Delegate Role',
        flex: 0.7,
        sortable: false,
        renderCell: (params) => {
          const row = params.row as OpDiv
          return (
            <Switch
              checked={row.system_delegate_enabled}
              disabled={!canToggleDelegate}
              onChange={() => setPendingDelegateToggle(row)}
              inputProps={{
                'aria-label': `Add System Delegate Role for ${row.code}`,
              }}
            />
          )
        },
      },
    ]
    // Create / edit / activate stay OWNER-only; HHS admin sees the grid but can
    // only flip the delegate toggle above.
    if (canManage) {
      cols.push({
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 120,
        getActions: (params) => {
          const row = params.row as OpDiv
          return [
            <GridActionsCellItem
              key={`edit-${row.opdiv_id}`}
              icon={<EditIcon />}
              label="Edit"
              onClick={() => openEdit(row)}
              color="inherit"
            />,
            <Tooltip
              key={`toggle-${row.opdiv_id}`}
              title={row.active ? 'Deactivate' : 'Activate'}
              placement="right-start"
            >
              <GridActionsCellItem
                icon={
                  row.active ? (
                    <BlockIcon sx={{ color: 'black' }} />
                  ) : (
                    <RestoreIcon sx={{ color: 'black' }} />
                  )
                }
                label={row.active ? 'Deactivate' : 'Activate'}
                onClick={() => setPendingToggle(row)}
                color="inherit"
              />
            </Tooltip>,
          ]
        },
      })
    }
    return cols
  }, [canManage, canToggleDelegate])

  if (!canAccess) return null

  return (
    <>
      <BreadCrumbs />
      <Typography variant="h3" sx={{ mb: 2 }}>
        Manage OpDivs
      </Typography>
      <Box sx={{ height: 600, width: '100%', mb: 2 }}>
        <DataGrid
          aria-label="Operating Divisions"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.opdiv_id}
          initialState={{
            sorting: { sortModel: [{ field: 'code', sort: 'asc' }] },
          }}
          slots={{ toolbar: CreateToolbar }}
          slotProps={{
            toolbar: { onCreate: openCreate, canCreate: canManage },
          }}
          disableColumnSelector
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#004297',
              color: '#fff',
            },
            '& .MuiDataGrid-sortIcon': { color: '#fff' },
            '& .MuiDataGrid-menuIconButton': { color: '#fff' },
          }}
        />
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        aria-label={editing ? 'Edit OpDiv' : 'Create OpDiv'}
      >
        <CustomDialogTitle title={editing ? 'Edit OpDiv' : 'Create OpDiv'} />
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              label="Code"
              required
              fullWidth
              variant="standard"
              margin="normal"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              error={!!fieldErrors.code}
              helperText={fieldErrors.code ?? `1-${CODE_MAX} characters`}
              inputProps={{ maxLength: CODE_MAX }}
              InputLabelProps={{ sx: { marginTop: 0 } }}
            />
            <TextField
              label="Name"
              required
              fullWidth
              variant="standard"
              margin="normal"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name ?? `1-${NAME_MAX} characters`}
              inputProps={{ maxLength: NAME_MAX }}
              InputLabelProps={{ sx: { marginTop: 0 } }}
            />
            <FormControlLabel
              sx={{ mt: 2 }}
              control={
                <Switch
                  checked={form.is_parent}
                  onChange={(e) =>
                    setForm({ ...form, is_parent: e.target.checked })
                  }
                />
              }
              label="Parent (department) row"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={closeDialog}>Cancel</CmsButton>
          <CmsButton onClick={handleSave}>Save</CmsButton>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        title={
          pendingToggle?.active
            ? 'Confirm Deactivate OpDiv'
            : 'Confirm Activate OpDiv'
        }
        confirmationText={
          pendingToggle
            ? pendingToggle.active
              ? `Deactivate ${pendingToggle.code} - ${pendingToggle.name}? It will be hidden from default OpDiv lists and its code frees up for reuse.`
              : `Reactivate ${pendingToggle.code} - ${pendingToggle.name}?`
            : ''
        }
        open={pendingToggle !== null}
        onClose={() => setPendingToggle(null)}
        confirmClick={handleConfirmToggle}
        confirmLabel={pendingToggle?.active ? 'Deactivate' : 'Reactivate'}
      />

      <ConfirmDialog
        title={
          pendingDelegateToggle?.system_delegate_enabled
            ? 'Disable System Delegate'
            : 'Enable System Delegate'
        }
        confirmationText={
          pendingDelegateToggle
            ? pendingDelegateToggle.system_delegate_enabled
              ? `Turn off System Delegate self-service for ${pendingDelegateToggle.code} - ${pendingDelegateToggle.name}? ISSOs will no longer be able to add delegates to systems in this OpDiv.`
              : `Turn on System Delegate self-service for ${pendingDelegateToggle.code} - ${pendingDelegateToggle.name}? ISSOs will be able to add delegates to systems in this OpDiv.`
            : ''
        }
        open={pendingDelegateToggle !== null}
        onClose={() => setPendingDelegateToggle(null)}
        confirmClick={handleConfirmDelegateToggle}
        confirmLabel={
          pendingDelegateToggle?.system_delegate_enabled ? 'Disable' : 'Enable'
        }
      />
    </>
  )
}
