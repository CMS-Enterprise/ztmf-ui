import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
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
import { endOfDayISO, startOfDayISO } from './dateBounds'
import { resourceLabel } from './resourceLabels'
import { actionLabel } from './actionLabels'

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
  from: Date | null
  to: Date | null
}

const EMPTY_FILTERS: Filters = {
  user: null,
  action: '',
  resource: '',
  system: null,
  from: null,
  to: null,
}

// A DatePicker hands back an Invalid Date mid-edit; only a real date maps to a
// query bound.
function isValidDate(d: Date | null): d is Date {
  return d !== null && !Number.isNaN(d.getTime())
}

type CompactDatePickerProps = {
  ariaLabel: string
  value: Date | null
  onChange: (value: Date | null) => void
  minDate?: Date
  maxDate?: Date
}

/**
 * The toolbar's date field: a MUI DatePicker sized to the 30px filter row,
 * with the calendar trigger icon scaled down so it sits inside the compact
 * field instead of dwarfing it.
 * @param {CompactDatePickerProps} props - Field label, value and bounds.
 * @returns {JSX.Element} The compact date picker.
 */
function CompactDatePicker({
  ariaLabel,
  value,
  onChange,
  minDate,
  maxDate,
}: CompactDatePickerProps) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      slotProps={{
        textField: {
          size: 'small',
          sx: { width: 160, ...controlSx },
          inputProps: { 'aria-label': ariaLabel },
        },
        openPickerButton: {
          size: 'small',
          'aria-label': `${ariaLabel} date`,
          sx: { p: 0.5 },
        },
        openPickerIcon: { sx: { fontSize: 18 } },
      }}
    />
  )
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

  const fromDate = isValidDate(filters.from) ? filters.from : null
  const toDate = isValidDate(filters.to) ? filters.to : null
  // Cap both fields at today: an audit trail has no future events.
  const today = new Date()

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
    if (fromDate) params.from = startOfDayISO(fromDate)
    if (toDate) params.to = endOfDayISO(toDate)

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
    // fromDate/toDate derive from filters.from/filters.to, which the
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

  const hasActiveFilters =
    filters.user !== null ||
    filters.action !== '' ||
    filters.resource !== '' ||
    filters.system !== null ||
    filters.from !== null ||
    filters.to !== null

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    // The debounce would clear it 400ms later; do it now so the request that
    // resets the table carries no stale resource term.
    setResourceQuery('')
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
      {
        field: 'action',
        headerName: 'Action',
        width: 130,
        sortable: false,
        // Capitalize the raw verb ("created" -> "Created").
        renderCell: ({ row }) => actionLabel(row.action),
      },
      {
        field: 'type',
        headerName: 'Resource',
        width: 200,
        sortable: false,
        // Show a friendly noun, not the raw database table name.
        renderCell: ({ row }) => resourceLabel(row.type),
      },
    ],
    []
  )

  if (!canAccess) return null

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
          {/* Filter toolbar inside the card, right-aligned like the Users /
            OpDivs toolbars; each control carries an aria-label instead of a
            floating label, and wraps when the row runs out of width. */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'flex-end',
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
              // Display capitalized; the option value stays the raw verb the
              // endpoint matches on.
              getOptionLabel={(action) => actionLabel(action)}
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
              isOptionEqualToValue={(a, b) =>
                a.fismasystemid === b.fismasystemid
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="System"
                  inputProps={{ ...params.inputProps, 'aria-label': 'System' }}
                />
              )}
            />
            {/* Themed MUI date pickers so the field and calendar inherit the
              design tokens. "From" cannot exceed "To" or today; "To" cannot
              precede "From". */}
            <CompactDatePicker
              ariaLabel="From"
              value={filters.from}
              onChange={(value) => setFilter('from', value)}
              maxDate={toDate ?? today}
            />
            <CompactDatePicker
              ariaLabel="To"
              value={filters.to}
              onChange={(value) => setFilter('to', value)}
              minDate={fromDate ?? undefined}
              maxDate={today}
            />
            <Button
              variant="text"
              size="small"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              sx={{
                fontSize: 13,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                color: colors.primary,
              }}
            >
              Clear filters
            </Button>
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
    </LocalizationProvider>
  )
}
