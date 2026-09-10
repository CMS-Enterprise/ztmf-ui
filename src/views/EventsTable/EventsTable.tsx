import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Autocomplete,
  Box,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { hasUnscopedRead } from '@/utils/userRoles'
import { Routes } from '@/router/constants'
import { EventWithUser, EventsPage, userData } from '@/types'
import { notify, isAuthHandled } from '@/utils/notify'
import { parseApiError } from '@/utils/apiErrors'
import { endOfDayISO, maskUSDate, parseUSDate, startOfDayISO } from './dateMask'

// The complete set of values that appear in events.action (see the backend's
// event-action constants). Display gating only; the endpoint accepts any
// string and simply matches nothing for an unknown one.
const ACTIONS = ['created', 'updated', 'deleted', 'viewed', 'imported']

// Matches the backend's default page size so the first request and the grid's
// initial state agree without a round of re-fetching.
const DEFAULT_PAGE_SIZE = 50

type Filters = {
  user: userData | null
  action: string
  resource: string
  system: number | null
  from: string
  to: string
}

// The CMS design system's global stylesheet gives every bare label a
// margin-block, which shoves MUI's absolutely-positioned floating labels down
// through the field border; every labeled TextField in the app zeroes it.
const LABEL_FIX = { sx: { marginTop: 0 } }

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
            <Typography variant="body2">
              {row.userfullname}
              {row.userdeleted ? ' (deleted)' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
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
    <Box sx={{ px: 3, py: 2 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        Events
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 260 }}
          options={users}
          value={filters.user}
          onChange={(_, value) => setFilter('user', value)}
          getOptionLabel={(u) => `${u.fullname} (${u.email})`}
          isOptionEqualToValue={(a, b) => a.userid === b.userid}
          renderInput={(params) => (
            <TextField
              {...params}
              label="User"
              InputLabelProps={{ ...params.InputLabelProps, ...LABEL_FIX }}
            />
          )}
        />
        <TextField
          select
          size="small"
          sx={{ minWidth: 140 }}
          label="Action"
          InputLabelProps={LABEL_FIX}
          value={filters.action}
          onChange={(e) => setFilter('action', e.target.value)}
        >
          <MenuItem value="">Any</MenuItem>
          {ACTIONS.map((action) => (
            <MenuItem key={action} value={action}>
              {action}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          sx={{ minWidth: 180 }}
          label="Resource"
          InputLabelProps={LABEL_FIX}
          value={filters.resource}
          onChange={(e) => setFilter('resource', e.target.value)}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={fismaSystems}
          value={
            fismaSystems.find((s) => s.fismasystemid === filters.system) ?? null
          }
          onChange={(_, value) =>
            setFilter('system', value ? value.fismasystemid : null)
          }
          getOptionLabel={(s) => s.fismaacronym}
          isOptionEqualToValue={(a, b) => a.fismasystemid === b.fismasystemid}
          renderInput={(params) => (
            <TextField
              {...params}
              label="System"
              InputLabelProps={{ ...params.InputLabelProps, ...LABEL_FIX }}
            />
          )}
        />
        <TextField
          size="small"
          sx={{ width: 150 }}
          label="From"
          InputLabelProps={LABEL_FIX}
          placeholder="MM/DD/YYYY"
          value={filters.from}
          error={fromField.invalid}
          helperText={fromField.invalid ? 'Invalid date' : undefined}
          onChange={(e) => setFilter('from', maskUSDate(e.target.value))}
          inputProps={{ inputMode: 'numeric' }}
        />
        <TextField
          size="small"
          sx={{ width: 150 }}
          label="To"
          InputLabelProps={LABEL_FIX}
          placeholder="MM/DD/YYYY"
          value={filters.to}
          error={toField.invalid}
          helperText={toField.invalid ? 'Invalid date' : undefined}
          onChange={(e) => setFilter('to', maskUSDate(e.target.value))}
          inputProps={{ inputMode: 'numeric' }}
        />
      </Box>
      <DataGrid
        autoHeight
        rows={rows}
        columns={columns}
        getRowId={(row) => row.eventid}
        loading={loading}
        // The endpoint owns ordering (createdat DESC, eventid tiebreaker) and
        // filtering; the grid is display-only, so its client-side machinery
        // is off across the board.
        paginationMode="server"
        rowCount={total}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[25, 50, 100, 250]}
        disableColumnFilter
        disableColumnMenu
        disableRowSelectionOnClick
        sx={{
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#004297',
            color: '#fff',
          },
          '& .MuiDataGrid-sortIcon': { color: '#fff' },
        }}
      />
    </Box>
  )
}
