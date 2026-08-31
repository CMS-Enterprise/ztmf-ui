import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Autocomplete, Box, TextField, Typography } from '@mui/material'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { hasUnscopedRead } from '@/utils/userRoles'
import { Routes } from '@/router/constants'
import { EventWithUser, EventsPage, userData } from '@/types'
import { notify, isAuthHandled } from '@/utils/notify'
import { parseApiError } from '@/utils/apiErrors'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import PageHeader from '@/components/ui/PageHeader'
import DataGridPaginationFooter from '@/components/ui/DataGridPaginationFooter'
import { colors, radius } from '@/theme/tokens'
import { endOfDayISO, maskUSDate, parseUSDate, startOfDayISO } from './dateMask'

// The complete set of values that appear in events.action (see the backend's
// event-action constants). Display gating only; the endpoint accepts any
// string and simply matches nothing for an unknown one.
const ACTIONS = ['created', 'updated', 'deleted', 'viewed', 'imported']

// Matches the backend's default page size so the first request and the grid's
// initial state agree without a round of re-fetching.
const DEFAULT_PAGE_SIZE = 50

// Compact 30px control height shared across the toolbar filters, matching the
// Users / OpDivs table toolbars.
const CONTROL_H = 30

// Toolbar controls carry an aria-label instead of a floating label (the
// redesign toolbars are placeholder-driven), sized down to the 30px row.
const controlSx = {
  '& .MuiInputBase-root': { height: CONTROL_H, fontSize: 13 },
}

// Autocomplete needs the height forced onto its inner input rows too.
const autocompleteSx = (width: number) => ({
  width,
  '& .MuiInputBase-root': {
    height: CONTROL_H,
    fontSize: 13,
    py: '0 !important',
  },
  '& .MuiAutocomplete-input': { py: '0 !important' },
})

type Filters = {
  user: userData | null
  action: string
  resource: string
  system: number | null
  from: string
  to: string
}

const EMPTY_FILTERS: Filters = {
  user: null,
  action: '',
  resource: '',
  system: null,
  from: '',
  to: '',
}

// A date field participates in the query only when complete and valid; a
// partial entry is just "still typing", never an error banner or a request.
function dateFieldState(value: string): {
  date: Date | null
  invalid: boolean
} {
  const date = parseUSDate(value)
  return { date, invalid: value.length === 10 && date === null }
}

/**
 * Admin-only audit-trail view over GET /events (ui#711, epic ui#183): a
 * server-paginated table with filters mapping one-to-one onto the endpoint's
 * query params. Gated to the unscoped-admin tiers the endpoint itself allows
 * (OWNER / HHS_ADMIN / HHS_READONLY_ADMIN); scoped tiers are bounced the same
 * way OpDivAdmin bounces non-write-admins. Payload detail is ui#712's scope.
 */
export default function EventsTable() {
  const navigate = useNavigate()
  const { userInfo, fismaSystems } = useContextProp()
  const canAccess = hasUnscopedRead(userInfo)

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  // Free-text resource is debounced so a request fires per pause, not per
  // keystroke; the structured filters apply immediately.
  const [resourceQuery, setResourceQuery] = useState('')
  const [users, setUsers] = useState<userData[]>([])
  const [rows, setRows] = useState<EventWithUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const fromField = dateFieldState(filters.from)
  const toField = dateFieldState(filters.to)

  useEffect(() => {
    if (userInfo.role && !canAccess) {
      navigate(Routes.ROOT, { replace: true })
    }
  }, [userInfo.role, canAccess, navigate])

  useEffect(() => {
    const handle = setTimeout(() => setResourceQuery(filters.resource), 400)
    return () => clearTimeout(handle)
  }, [filters.resource])

  useEffect(() => {
    if (!canAccess) return
    const controller = new AbortController()
    axiosInstance
      .get('/users', { signal: controller.signal })
      .then((res) => setUsers(res.data.data ?? []))
      .catch((error) => {
        if (isAuthHandled(error) || controller.signal.aborted) return
        notify('Unable to load users for the filter', 'error')
      })
    return () => controller.abort()
  }, [canAccess])

  useEffect(() => {
    if (!canAccess) return
    // An invalid complete date never fires a request the admin didn't mean;
    // the field shows its error state until corrected.
    if (fromField.invalid || toField.invalid) return
    const controller = new AbortController()
    const params: Record<string, string | number> = {
      limit: paginationModel.pageSize,
      offset: paginationModel.page * paginationModel.pageSize,
    }
    if (filters.user) params.userid = filters.user.userid
    if (filters.action) params.action = filters.action
    if (resourceQuery) params.resource = resourceQuery
    if (filters.system !== null)
      params['payload.fismasystemid'] = filters.system
    if (fromField.date) params.from = startOfDayISO(fromField.date)
    if (toField.date) params.to = endOfDayISO(toField.date)

    setLoading(true)
    axiosInstance
      .get('/events', { params, signal: controller.signal })
      .then((res) => {
        const page: EventsPage = res.data.data
        setRows(page.events)
        setTotal(page.total)
      })
      .catch((error) => {
        if (isAuthHandled(error) || controller.signal.aborted) return
        notify(parseApiError(error).message, 'error')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // fromField/toField derive from filters.from/filters.to, which the
    // dependency list carries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canAccess,
    paginationModel,
    filters.user,
    filters.action,
    resourceQuery,
    filters.system,
    filters.from,
    filters.to,
  ])

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    // Any filter change restarts from the first page; a preserved offset
    // could point past the new result set's end.
    setPaginationModel((prev) => ({ ...prev, page: 0 }))
  }

  const columns: GridColDef<EventWithUser>[] = useMemo(
    () => [
      {
        field: 'createdat',
        headerName: 'Date',
        width: 200,
        sortable: false,
        valueFormatter: (params) =>
          params.value ? new Date(params.value as string).toLocaleString() : '',
      },
      {
        field: 'userfullname',
        headerName: 'User',
        flex: 1,
        minWidth: 240,
        sortable: false,
        renderCell: ({ row }) => (
          <Box>
            <Typography
              sx={{ fontSize: 14, fontWeight: 600, color: colors.ink }}
            >
              {row.userfullname}
              {row.userdeleted ? ' (deleted)' : ''}
            </Typography>
            <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
              {row.useremail}
            </Typography>
          </Box>
        ),
      },
      { field: 'action', headerName: 'Action', width: 130, sortable: false },
      { field: 'type', headerName: 'Resource', width: 200, sortable: false },
    ],
    []
  )

  if (!canAccess) return null

  return (
    <Box sx={{ pt: 3, pb: 4, boxSizing: 'border-box' }}>
      <PageHeader
        title="Events"
        subtitle={total > 0 ? `${total.toLocaleString()} events` : undefined}
        breadcrumbs={<BreadCrumbs />}
      />
      <Box
        sx={{
          backgroundColor: colors.white,
          border: `1px solid ${colors.neutral200}`,
          borderRadius: `${radius.card}px`,
          overflow: 'hidden',
        }}
      >
        {/* Filter toolbar inside the card, mirroring the Users / OpDivs
            toolbars. Six controls, so it wraps rather than right-aligning on
            one row; each carries an aria-label instead of a floating label. */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            px: 2.25,
            py: 1.5,
            borderBottom: `1px solid ${colors.neutral200}`,
          }}
        >
          <Autocomplete
            size="small"
            sx={autocompleteSx(240)}
            options={users}
            value={filters.user}
            onChange={(_, value) => setFilter('user', value)}
            getOptionLabel={(u) => `${u.fullname} (${u.email})`}
            isOptionEqualToValue={(a, b) => a.userid === b.userid}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="User"
                inputProps={{ ...params.inputProps, 'aria-label': 'User' }}
              />
            )}
          />
          <Autocomplete
            size="small"
            sx={autocompleteSx(150)}
            options={ACTIONS}
            value={filters.action || null}
            onChange={(_, value) => setFilter('action', value ?? '')}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Action"
                inputProps={{ ...params.inputProps, 'aria-label': 'Action' }}
              />
            )}
          />
          <TextField
            size="small"
            sx={{ width: 180, ...controlSx }}
            placeholder="Resource"
            value={filters.resource}
            onChange={(e) => setFilter('resource', e.target.value)}
            inputProps={{ 'aria-label': 'Resource' }}
          />
          <Autocomplete
            size="small"
            sx={autocompleteSx(200)}
            options={fismaSystems}
            value={
              fismaSystems.find((s) => s.fismasystemid === filters.system) ??
              null
            }
            onChange={(_, value) =>
              setFilter('system', value ? value.fismasystemid : null)
            }
            getOptionLabel={(s) => s.fismaacronym}
            isOptionEqualToValue={(a, b) => a.fismasystemid === b.fismasystemid}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="System"
                inputProps={{ ...params.inputProps, 'aria-label': 'System' }}
              />
            )}
          />
          <TextField
            size="small"
            sx={{ width: 150, ...controlSx }}
            placeholder="From (MM/DD/YYYY)"
            value={filters.from}
            error={fromField.invalid}
            helperText={fromField.invalid ? 'Invalid date' : undefined}
            onChange={(e) => setFilter('from', maskUSDate(e.target.value))}
            inputProps={{ inputMode: 'numeric', 'aria-label': 'From' }}
          />
          <TextField
            size="small"
            sx={{ width: 150, ...controlSx }}
            placeholder="To (MM/DD/YYYY)"
            value={filters.to}
            error={toField.invalid}
            helperText={toField.invalid ? 'Invalid date' : undefined}
            onChange={(e) => setFilter('to', maskUSDate(e.target.value))}
            inputProps={{ inputMode: 'numeric', 'aria-label': 'To' }}
          />
        </Box>
        {/* Fixed grid height (parity with OpDivs): rows scroll inside the grid
            while the page scrolls around the card. */}
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            aria-label="Events"
            rows={rows}
            columns={columns}
            getRowId={(row) => row.eventid}
            loading={loading}
            // The endpoint owns ordering (createdat DESC, eventid tiebreaker)
            // and filtering; the grid is display-only, so its client-side
            // machinery is off across the board.
            paginationMode="server"
            rowCount={total}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[25, 50, 100, 250]}
            slots={{ footer: DataGridPaginationFooter }}
            // Server mode: hand the footer the true total, since the grid only
            // holds the current page's rows.
            slotProps={{
              footer: { rowCount: total, pageSizes: [25, 50, 100, 250] },
            }}
            disableColumnFilter
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
            }}
          />
        </Box>
      </Box>
    </Box>
  )
}
