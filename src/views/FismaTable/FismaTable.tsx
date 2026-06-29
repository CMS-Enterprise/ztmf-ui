import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridActionsCellItem,
  GridRowParams,
} from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import {
  Box,
  InputBase,
  TextField,
  Typography,
  Autocomplete,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import { useNavigate, Link } from 'react-router-dom'
import { RouteNames } from '@/router/constants'
import { useContextProp } from '../Title/Context'
import VisibilityIcon from '@mui/icons-material/Visibility'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import BarChartIcon from '@mui/icons-material/BarChart'
import { FismaTableProps } from '@/types'
import type { OpDiv } from '@/types'
import { hasSystemAccess } from '@/utils/userRoles'
import { fetchOpDivs } from '@/utils/opdivs'
import ScoreDisplay from '@/components/ui/ScoreDisplay'
import { CodeBadge, StatusChip } from '@/components/ui/StatusChip'
import DataGridPaginationFooter from '@/components/ui/DataGridPaginationFooter'
import CompactSwitchLabel from '@/components/ui/CompactSwitchLabel'
import { colors, fonts, radius } from '@/theme/tokens'

// Short aliases for OpDiv codes longer than the 6-char column budget.
const OPDIV_ALIASES: Record<string, string> = { REBELLION: 'REBEL' }

/**
 * Aliases or caps an OpDiv code to at most 6 characters for the OpDiv column.
 * @param {string} code - The raw OpDiv code.
 * @returns {string} A short code (<= 6 chars).
 */
function formatOpDivCode(code: string): string {
  const aliased = OPDIV_ALIASES[code.toUpperCase()] ?? code
  return aliased.length > 6 ? aliased.slice(0, 6) : aliased
}

/** Page sizes offered in the pagination footer. */
const PAGE_SIZES = [25, 50, 100]

/**
 * Card header for the systems table: the title and count on the left, with the
 * search box, OpDiv filter and decommissioned toggle on the right.
 */
function TableToolbar({
  count,
  search,
  setSearch,
  opdivs,
  opdivFilter,
  setOpDivFilter,
  showDecommissioned,
  setShowDecommissioned,
}: {
  count: number
  search: string
  setSearch: (value: string) => void
  opdivs: OpDiv[]
  opdivFilter: number | 'all'
  setOpDivFilter: (value: number | 'all') => void
  showDecommissioned: boolean
  setShowDecommissioned: (value: boolean) => void
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        borderBottom: `1px solid ${colors.neutral200}`,
      }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
        FISMA systems
      </Typography>
      <Typography
        sx={{ fontSize: 12, fontWeight: 500, color: colors.neutral500 }}
      >
        {count} {count === 1 ? 'system' : 'systems'}
      </Typography>
      <Box
        sx={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
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
            placeholder="Search systems"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ fontSize: 13, width: 150 }}
            inputProps={{ 'aria-label': 'Search systems' }}
          />
        </Box>
        <Autocomplete
          size="small"
          options={opdivs}
          getOptionLabel={(od) => od.code}
          isOptionEqualToValue={(option, value) =>
            option.opdiv_id === value.opdiv_id
          }
          value={
            opdivFilter === 'all'
              ? null
              : opdivs.find((od) => od.opdiv_id === opdivFilter) ?? null
          }
          onChange={(_event, od) => setOpDivFilter(od ? od.opdiv_id : 'all')}
          renderOption={(props, option) => {
            const { key, ...rest } = props
            return (
              <li key={key} {...rest}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                    {option.code}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
                    {option.name}
                  </Typography>
                </Box>
              </li>
            )
          }}
          sx={{
            width: 180,
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
              placeholder="All OpDivs"
              inputProps={{
                ...params.inputProps,
                'aria-label': 'Filter by OpDiv',
              }}
            />
          )}
        />
        <CompactSwitchLabel
          checked={showDecommissioned}
          onChange={setShowDecommissioned}
          label="Show decommissioned"
        />
      </Box>
    </Box>
  )
}

/**
 * The FISMA systems table on the dashboard. Renders the systems list with a
 * bar+value+tier score, OpDiv badge and status chip, plus row actions to open
 * the questionnaire, pillar scores, and system detail. Search is shared with
 * the header box; OpDiv and decommissioned filters narrow the rows.
 * @param {FismaTableProps} props - Component props.
 * @param {Record<number, SystemScoreEntry>} props.scores - Score map keyed by
 *   fismasystemid.
 * @returns {JSX.Element} The systems table card.
 */
export default function FismaTable({
  scores,
  selectedRows,
  onSelectionChange,
}: FismaTableProps) {
  // Selection mode is opt-in: the parent enables it by passing handlers. This
  // keeps the table usable on pages that don't surface an Export CSV action.
  const selectionEnabled =
    selectedRows !== undefined && onSelectionChange !== undefined
  const {
    fismaSystems,
    userInfo,
    showDecommissioned,
    setShowDecommissioned,
    dashboardSearch,
    setDashboardSearch,
  } = useContextProp()
  const hasSystemDetailAccess = hasSystemAccess(userInfo)
  const navigate = useNavigate()
  const [opdivs, setOpDivs] = useState<OpDiv[]>([])
  const [opdivFilter, setOpDivFilter] = useState<number | 'all'>('all')

  // OpDiv reference list, for both the filter dropdown and the code badges.
  useEffect(() => {
    let active = true
    fetchOpDivs(true)
      .then((list) => {
        if (active) setOpDivs(list)
      })
      .catch(() => {
        if (active) setOpDivs([])
      })
    return () => {
      active = false
    }
  }, [])

  const opdivCodeMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const od of opdivs) map[od.opdiv_id] = od.code
    return map
  }, [opdivs])

  const rows = useMemo(
    () =>
      opdivFilter === 'all'
        ? fismaSystems
        : fismaSystems.filter((s) => s.opdiv_id === opdivFilter),
    [fismaSystems, opdivFilter]
  )

  const quickFilterValues = dashboardSearch.trim()
    ? dashboardSearch.trim().split(/\s+/)
    : []

  const columns: GridColDef[] = [
    {
      field: 'fismaname',
      headerName: 'System',
      flex: 2,
      minWidth: 240,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => {
        // Subtitle pulls from mission/component only - datacenterenvironment
        // has its own column, so showing it here would duplicate.
        const subtitle = params.row.mission || params.row.component || ''
        return (
          <Box>
            <Link
              to={`/systems/${params.row.fismasystemid}`}
              style={{
                color: colors.ink,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                display: 'block',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {params.row.fismaname}
            </Link>
            {subtitle && (
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: colors.neutral500,
                  mt: 0.25,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        )
      },
    },
    {
      field: 'fismaacronym',
      headerName: 'Acronym',
      flex: 0.7,
      minWidth: 90,
      renderCell: (params) => (
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 13,
            fontWeight: 600,
            color: colors.ink,
          }}
        >
          {params.row.fismaacronym}
        </Typography>
      ),
    },
    {
      field: 'issoemail',
      headerName: 'ISSO',
      flex: 1.1,
      minWidth: 140,
      // Derive a "First Last" display name from the ISSO email local-part
      // (john.doe@x.com -> "John Doe"). Falls back to the raw local-part
      // when the email is a single token. Same logic main has used since
      // before the redesign so the column reads the same way.
      valueGetter: (value) => {
        const local = (value.row.issoemail ?? '').split('@')[0] ?? ''
        const parts = local.replace(/[0-9]/g, '').split('.')
        if (parts.length <= 1) return parts[0] ?? ''
        const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : '')
        return `${cap(parts[0])} ${cap(parts[1])}`
      },
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: colors.ink }}>
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'opdiv',
      headerName: 'OpDiv',
      flex: 0.8,
      minWidth: 100,
      valueGetter: (params) =>
        params.row.opdiv_id
          ? formatOpDivCode(opdivCodeMap[params.row.opdiv_id] ?? '')
          : '',
      renderCell: (params) =>
        params.value ? <CodeBadge code={String(params.value)} /> : null,
    },
    {
      field: 'datacenterenvironment',
      headerName: 'Data center',
      flex: 1,
      minWidth: 130,
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
          {params.row.datacenterenvironment || '-'}
        </Typography>
      ),
    },
    {
      field: 'Score',
      headerName: 'Zero Trust Score',
      type: 'number',
      width: 240,
      align: 'left',
      headerAlign: 'left',
      hideable: false,
      valueGetter: (value) => {
        const entry = scores[value.row.fismasystemid]
        return entry?.score ?? 0
      },
      renderCell: (params) => {
        const entry = scores[params.row.fismasystemid]
        return <ScoreDisplay score={entry?.score} tier={entry?.tier} />
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.8,
      minWidth: 110,
      valueGetter: (params) =>
        params.row.decommissioned ? 'Decommissioned' : 'Active',
      renderCell: (params) =>
        params.row.decommissioned ? (
          <StatusChip label="Decom." kind="neutral" />
        ) : (
          <StatusChip label="Active" kind="active" />
        ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      headerAlign: 'right',
      align: 'right',
      width: 130,
      minWidth: 130,
      hideable: false,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams) => (
        <>
          <Tooltip title="Questionnaire">
            <span>
              <GridActionsCellItem
                icon={
                  <QuestionAnswerOutlinedIcon
                    fontSize="small"
                    sx={{ color: colors.neutral700 }}
                  />
                }
                key={`question-${params.row.fismasystemid}`}
                label={`View Questionnaire for ${params.row.fismaname}`}
                role="button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(
                    `/${RouteNames.QUESTIONNAIRE}/${params.row.fismaacronym.toLowerCase()}`,
                    { state: { fismasystemid: params.row.fismasystemid } }
                  )
                }}
                color="inherit"
              />
            </span>
          </Tooltip>
          <Tooltip title="Pillar scores">
            <span>
              <GridActionsCellItem
                icon={
                  <BarChartIcon
                    fontSize="small"
                    sx={{ color: colors.neutral700 }}
                  />
                }
                key={`chart-${params.row.fismasystemid}`}
                label={`View Pillar Scores for ${params.row.fismaname}`}
                role="button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(`/systems/${params.row.fismasystemid}/pillar-scores`)
                }}
                color="inherit"
              />
            </span>
          </Tooltip>
          {hasSystemDetailAccess && (
            <Tooltip title="System details">
              <span>
                <GridActionsCellItem
                  icon={
                    <VisibilityIcon
                      fontSize="small"
                      sx={{ color: colors.neutral700 }}
                    />
                  }
                  key={`view-${params.row.fismasystemid}`}
                  label={`View system details for ${params.row.fismaname}`}
                  role="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(`/systems/${params.row.fismasystemid}`)
                  }}
                  color="inherit"
                />
              </span>
            </Tooltip>
          )}
        </>
      ),
    },
  ]

  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        overflow: 'hidden',
        // Fill the remaining canvas above the CMS footer (Home is a flex
        // column; main is the scroll container). min-height: 0 lets the
        // DataGrid inside us scroll internally instead of growing the card.
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TableToolbar
        count={rows.length}
        search={dashboardSearch}
        setSearch={setDashboardSearch}
        opdivs={opdivs}
        opdivFilter={opdivFilter}
        setOpDivFilter={setOpDivFilter}
        showDecommissioned={showDecommissioned}
        setShowDecommissioned={setShowDecommissioned}
      />
      <Box sx={{ flex: 1, minHeight: 0, width: '100%', display: 'flex' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.fismasystemid}
          rowHeight={60}
          // Clicks on the row body navigate (handled by the System link in
          // the first column); only the checkbox toggles selection.
          disableRowSelectionOnClick
          checkboxSelection={selectionEnabled}
          rowSelectionModel={selectionEnabled ? selectedRows : undefined}
          onRowSelectionModelChange={
            selectionEnabled
              ? (ids) => onSelectionChange!(ids.map((id) => Number(id)))
              : undefined
          }
          // Matches main: only scored systems are selectable, since there's
          // nothing to export for a "Not Assessed" row.
          isRowSelectable={
            selectionEnabled
              ? (params: GridRowParams) => params.row.fismasystemid in scores
              : undefined
          }
          disableColumnSelector
          // Each table already has its own search + filters in the toolbar.
          // The DataGrid's per-column 3-dot menu adds nothing here and its
          // built-in filter popup conflicts with the CMS DSG global styles
          // (overlapping labels). Disable it on every column.
          disableColumnMenu
          filterModel={{ items: [], quickFilterValues }}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          pageSizeOptions={PAGE_SIZES}
          slots={{ footer: DataGridPaginationFooter }}
          sx={{
            // Grow into the flex parent so the grid's internal scroll
            // (not main's) handles row overflow.
            flex: 1,
            minHeight: 0,
            border: 'none',
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: colors.neutral50,
            },
            // Hairline row separators per the redesign spec.
            '& .MuiDataGrid-cell': {
              borderBottom: `1px solid ${colors.neutral100}`,
            },
            // Subtle rounded-hover background on the row action icon buttons.
            '& .MuiDataGrid-actionsCell .MuiIconButton-root:hover, & [data-field="actions"] .MuiButtonBase-root:hover':
              {
                backgroundColor: colors.neutral100,
              },
          }}
        />
      </Box>
    </Box>
  )
}
