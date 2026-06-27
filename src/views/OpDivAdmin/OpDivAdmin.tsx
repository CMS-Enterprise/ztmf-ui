import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'
import {
  Autocomplete,
  FormControlLabel,
  InputBase,
  OutlinedInput,
  Switch,
  TextField,
} from '@mui/material'
import Field, { fieldInputSx } from '@/components/ds/Field'
import SearchIcon from '@mui/icons-material/Search'
import Modal from '@/components/ds/Modal'
import CompactSwitchLabel from '@/components/ds/CompactSwitchLabel'
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

type TypeFilter = 'all' | 'parent' | 'child'

const TYPE_FILTER_OPTIONS: {
  value: Exclude<TypeFilter, 'all'>
  label: string
}[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
]

interface OpDivsToolbarProps {
  search: string
  setSearch: (value: string) => void
  typeFilter: TypeFilter
  setTypeFilter: (value: TypeFilter) => void
  showDeactivated: boolean
  setShowDeactivated: (value: boolean) => void
}

/**
 * Toolbar inside the Manage OpDivs table card. Mirrors the Dashboard /
 * Users table toolbars: search input + Type filter + "Show deactivated"
 * toggle, all right-aligned and sharing a uniform 30px row.
 */
function OpDivsToolbar({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  showDeactivated,
  setShowDeactivated,
}: OpDivsToolbarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
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
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ fontSize: 13, width: 220 }}
          inputProps={{ 'aria-label': 'Search OpDivs' }}
        />
      </Box>
      <Autocomplete
        size="small"
        options={TYPE_FILTER_OPTIONS}
        getOptionLabel={(opt) => opt.label}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        value={
          typeFilter === 'all'
            ? null
            : TYPE_FILTER_OPTIONS.find((opt) => opt.value === typeFilter) ??
              null
        }
        onChange={(_event, opt) =>
          setTypeFilter((opt?.value ?? 'all') as TypeFilter)
        }
        sx={{
          width: 140,
          '& .MuiInputBase-root': {
            height: 30,
            fontSize: 13,
            py: '0 !important',
          },
          '& .MuiAutocomplete-input': { py: '0 !important' },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Type"
            inputProps={{
              ...params.inputProps,
              'aria-label': 'Filter by type',
            }}
          />
        )}
      />
      <CompactSwitchLabel
        checked={showDeactivated}
        onChange={setShowDeactivated}
        label="Show deactivated"
      />
    </Box>
  )
}

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
  // Toolbar filter state: search threads into the DataGrid as a quick-filter,
  // type narrows the row set client-side so the /opdivs response shape stays
  // unchanged. showDeactivated swaps the visible set between active-only and
  // deactivated-only, mirroring the Users / Dashboard toggles.
  const [search, setSearch] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [showDeactivated, setShowDeactivated] = useState<boolean>(false)

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

  // Client-side filter: status (active vs deactivated) + Type. Search threads
  // through DataGrid's quick filter so it can match Code, Name, Type and
  // Systems uniformly.
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (showDeactivated ? r.active : !r.active) return false
      if (typeFilter !== 'all') {
        const wantParent = typeFilter === 'parent'
        if (r.is_parent !== wantParent) return false
      }
      return true
    })
  }, [rows, typeFilter, showDeactivated])
  const quickFilterValues = search.trim()
    ? search.trim().split(/\s+/)
    : undefined

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
        <OpDivsToolbar
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          showDeactivated={showDeactivated}
          setShowDeactivated={setShowDeactivated}
        />
        <Box sx={{ flex: 1, minHeight: 0, width: '100%', display: 'flex' }}>
          <DataGrid
            aria-label="Operating Divisions"
            rows={filteredRows}
            columns={columns}
            getRowId={(row) => row.opdiv_id}
            getRowHeight={() => 64}
            filterModel={{ items: [], quickFilterValues }}
            initialState={{
              sorting: { sortModel: [{ field: 'code', sort: 'asc' }] },
              pagination: { paginationModel: { pageSize: 25, page: 0 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            slots={{ footer: DataGridPaginationFooter }}
            disableColumnSelector
            // Table has its own search + filters in the toolbar; hide every
            // per-column 3-dot menu (its filter popup overlaps with the CMS
            // DSG global stylesheet too).
            disableColumnMenu
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Field
            id="opdiv-code"
            label="Code"
            required
            error={fieldErrors.code}
            helperText={`1-${CODE_MAX} characters`}
          >
            <OutlinedInput
              id="opdiv-code"
              fullWidth
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              error={!!fieldErrors.code}
              inputProps={{ maxLength: CODE_MAX }}
              sx={fieldInputSx}
            />
          </Field>
          <Field
            id="opdiv-name"
            label="Name"
            required
            error={fieldErrors.name}
            helperText={`1-${NAME_MAX} characters`}
          >
            <OutlinedInput
              id="opdiv-name"
              fullWidth
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={!!fieldErrors.name}
              inputProps={{ maxLength: NAME_MAX }}
              sx={fieldInputSx}
            />
          </Field>
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
