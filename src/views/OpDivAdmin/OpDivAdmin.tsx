import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'
import { FormControlLabel, Switch, TextField } from '@mui/material'
import Modal from '@/components/ds/Modal'
import { DataGrid, GridActionsCellItem, GridColDef } from '@mui/x-data-grid'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import PageHeader from '@/components/ds/PageHeader'
import StatusChip, { CodeBadge } from '@/components/ds/StatusChip'
import DataGridPaginationFooter from '@/components/ds/DataGridPaginationFooter'
import { colors, radius } from '@/theme/tokens'
import { useContextProp } from '../Title/Context'
import { Routes } from '@/router/constants'
import {
  createOpDiv,
  fetchOpDivs,
  updateOpDiv,
  type OpDivInput,
} from '@/utils/opdivs'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import type { OpDiv } from '@/types'

const CODE_MAX = 16
const NAME_MAX = 128

type FormState = { code: string; name: string; is_parent: boolean }
const EMPTY_FORM: FormState = { code: '', name: '', is_parent: false }

export default function OpDivAdmin() {
  const navigate = useNavigate()
  const { userInfo, fismaSystems } = useContextProp()
  const isOwner = userInfo.role === 'OWNER'

  const [rows, setRows] = useState<OpDiv[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OpDiv | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pendingToggle, setPendingToggle] = useState<OpDiv | null>(null)

  // OWNER is the tenant boundary - everyone else is bounced, mirroring the
  // redirect guard UserTable uses. The backend also returns 403.
  useEffect(() => {
    if (userInfo.role && !isOwner) {
      navigate(Routes.ROOT, { replace: true })
    }
  }, [userInfo.role, isOwner, navigate])

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
    if (isOwner) loadOpDivs()
  }, [isOwner, loadOpDivs])

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

  // Count of FISMA systems per OpDiv for the "Systems" column. Read directly
  // off the systems list the root loader hydrates into context, so no extra
  // fetch is needed.
  const systemCountByOpDiv = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const sys of fismaSystems) {
      if (sys.opdiv_id) counts[sys.opdiv_id] = (counts[sys.opdiv_id] ?? 0) + 1
    }
    return counts
  }, [fismaSystems])

  // Subtitle counts shown under the page title.
  const activeCount = rows.filter((r) => r.active).length
  const deactivatedCount = rows.filter((r) => !r.active).length
  const subtitleParts: string[] = []
  if (activeCount > 0) subtitleParts.push(`${activeCount} active`)
  if (deactivatedCount > 0)
    subtitleParts.push(`${deactivatedCount} deactivated`)
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : ''

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'code',
        headerName: 'Code',
        flex: 0.6,
        minWidth: 110,
        renderCell: (params) => (
          <CodeBadge code={params.row.code} muted={!params.row.active} />
        ),
      },
      {
        field: 'name',
        headerName: 'Name',
        flex: 1.4,
        minWidth: 200,
        renderCell: (params) => (
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: 14,
              color: params.row.active ? colors.ink : colors.neutral500,
            }}
          >
            {params.row.name}
          </Typography>
        ),
      },
      {
        field: 'is_parent',
        headerName: 'Type',
        flex: 0.8,
        minWidth: 130,
        // Data model only has is_parent (boolean) - no parent_id reference -
        // so "Child" is the best we can offer without a backend change. When
        // parent_id lands we can show "Child of {parentCode}".
        valueGetter: (params) => (params.row.is_parent ? 'Parent' : 'Child'),
        renderCell: (params) => (
          <Typography
            sx={{
              fontSize: 13,
              color: params.row.active ? colors.neutral700 : colors.neutral500,
            }}
          >
            {params.row.is_parent ? 'Parent' : 'Child'}
          </Typography>
        ),
      },
      {
        field: 'systems',
        headerName: 'Systems',
        flex: 0.7,
        minWidth: 110,
        valueGetter: (params) => systemCountByOpDiv[params.row.opdiv_id] ?? 0,
        renderCell: (params) => {
          const count = systemCountByOpDiv[params.row.opdiv_id] ?? 0
          return (
            <Typography
              sx={{
                fontSize: 13,
                color: params.row.active ? colors.ink : colors.neutral500,
              }}
            >
              {count} {count === 1 ? 'system' : 'systems'}
            </Typography>
          )
        },
      },
      {
        field: 'active',
        headerName: 'Status',
        flex: 0.7,
        minWidth: 120,
        valueGetter: (params) => (params.row.active ? 'Active' : 'Deactivated'),
        renderCell: (params) =>
          params.row.active ? (
            <StatusChip label="Active" kind="active" />
          ) : (
            <StatusChip label="Deactivated" kind="neutral" />
          ),
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        headerAlign: 'right',
        align: 'right',
        // Wider so a "Reactivate" text button fits on deactivated rows and
        // the edit + deactivate icon pair still has breathing room on active.
        width: 140,
        getActions: (params) => {
          const row = params.row as OpDiv
          if (!row.active) {
            // Deactivated row: show a single "Reactivate" outline button per
            // the mock, matching the Resend pattern on invited users.
            return [
              <Button
                key={`reactivate-${row.opdiv_id}`}
                variant="outlined"
                size="small"
                sx={{
                  minHeight: 28,
                  py: 0.25,
                  px: 1.5,
                  fontSize: 13,
                  color: colors.primary,
                  borderColor: colors.neutral200,
                }}
                onClick={() => setPendingToggle(row)}
              >
                Reactivate
              </Button>,
            ]
          }
          return [
            <GridActionsCellItem
              key={`edit-${row.opdiv_id}`}
              icon={
                <EditIcon fontSize="small" sx={{ color: colors.neutral700 }} />
              }
              label="Edit OpDiv"
              onClick={() => openEdit(row)}
              color="inherit"
            />,
            <GridActionsCellItem
              key={`deactivate-${row.opdiv_id}`}
              icon={
                <BlockIcon fontSize="small" sx={{ color: colors.neutral700 }} />
              }
              label="Deactivate OpDiv"
              onClick={() => setPendingToggle(row)}
              color="inherit"
            />,
          ]
        },
      },
    ],
    [systemCountByOpDiv]
  )

  if (!isOwner) return null

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
        title="Manage OpDivs"
        subtitle={subtitle || undefined}
        breadcrumbs={<BreadCrumbs />}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            Create OpDiv
          </Button>
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
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, width: '100%', display: 'flex' }}>
          <DataGrid
            aria-label="Operating Divisions"
            rows={rows}
            columns={columns}
            getRowId={(row) => row.opdiv_id}
            getRowHeight={() => 64}
            initialState={{
              sorting: { sortModel: [{ field: 'code', sort: 'asc' }] },
              pagination: { paginationModel: { pageSize: 25, page: 0 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            slots={{ footer: DataGridPaginationFooter }}
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
            }}
          />
        </Box>
      </Box>

      <Modal
        open={dialogOpen}
        onClose={closeDialog}
        title={editing ? 'Edit OpDiv' : 'Create OpDiv'}
        size="sm"
        disableBackdropClose
        footer={
          <>
            <Button variant="text" color="inherit" onClick={closeDialog}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleSave}>
              {editing ? 'Save changes' : 'Create OpDiv'}
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Code"
            required
            fullWidth
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            error={!!fieldErrors.code}
            helperText={fieldErrors.code ?? `1-${CODE_MAX} characters`}
            inputProps={{ maxLength: CODE_MAX }}
          />
          <TextField
            label="Name"
            required
            fullWidth
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name ?? `1-${NAME_MAX} characters`}
            inputProps={{ maxLength: NAME_MAX }}
          />
          <FormControlLabel
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
      </Modal>

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
    </Box>
  )
}
