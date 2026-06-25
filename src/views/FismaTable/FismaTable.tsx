import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridActionsCellItem,
} from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import {
  Box,
  InputBase,
  TextField,
  MenuItem,
  Typography,
  FormControlLabel,
  Switch,
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
import ScoreDisplay from '@/components/ds/ScoreDisplay'
import { CodeBadge, StatusChip } from '@/components/ds/StatusChip'
import DataGridPaginationFooter from '@/components/ds/DataGridPaginationFooter'
import { colors, fonts, radius } from '@/theme/tokens'

const ELLIPSIS = '…'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Short aliases for OpDiv codes longer than the 6-char column budget.
const OPDIV_ALIASES: Record<string, string> = { REBELLION: 'REBEL' }

/**
 * Formats a FISMA id for the table. When the only id is a UUID, show just the
 * first segment with an ellipsis; the full value goes in a tooltip.
 * @param {string} uid - The raw FISMA uid.
 * @returns {{ display: string, full: string, truncated: boolean }} Display parts.
 */
function formatFismaId(uid: string): {
  display: string
  full: string
  truncated: boolean
} {
  if (uid && UUID_RE.test(uid)) {
    return {
      display: `${uid.split('-')[0]}${ELLIPSIS}`,
      full: uid,
      truncated: true,
    }
  }
  return { display: uid ?? '', full: uid ?? '', truncated: false }
}

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
            minWidth: 130,
            // Lock the outer outlined input AND the inner select cell to 30px;
            // small TextFields default to ~40px from the notched outline.
            '& .MuiInputBase-root': {
              height: 30,
              fontSize: 13,
            },
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
          <MenuItem value="all">All OpDivs</MenuItem>
          {opdivs.map((od) => (
            <MenuItem key={od.opdiv_id} value={od.opdiv_id}>
              {od.code}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          // The MUI Switch carries 12px padding by default so its bounding box
          // is ~38px tall - the toggle sits below the 30px inputs even with
          // center alignment. Zero the wrapper margins and compact the switch
          // so the row reads as one flush horizontal band.
          sx={{
            m: 0,
            height: 30,
            '& .MuiSwitch-root': { padding: 0, width: 32, height: 18, mr: 1 },
            '& .MuiSwitch-switchBase': { padding: 0.25 },
            '& .MuiSwitch-thumb': { width: 14, height: 14 },
            '& .MuiSwitch-track': { borderRadius: 999 },
          }}
          control={
            <Switch
              checked={showDecommissioned}
              onChange={(e) => setShowDecommissioned(e.target.checked)}
            />
          }
          label={
            <Typography sx={{ fontSize: 13 }}>Show decommissioned</Typography>
          }
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
export default function FismaTable({ scores }: FismaTableProps) {
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
        // Prefer a real description; fall back to whatever context exists so
        // the row never reads as a single bare line.
        const subtitle =
          params.row.mission ||
          params.row.component ||
          params.row.datacenterenvironment ||
          ''
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
      field: 'fismauid',
      headerName: 'FISMA ID',
      flex: 0.9,
      minWidth: 110,
      renderCell: (params) => {
        const { display, full, truncated } = formatFismaId(params.row.fismauid)
        const text = (
          <Typography
            sx={{
              fontFamily: fonts.mono,
              fontSize: 13,
              color: colors.neutral700,
            }}
          >
            {display}
          </Typography>
        )
        return truncated ? <Tooltip title={full}>{text}</Tooltip> : text
      },
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
          disableRowSelectionOnClick
          disableColumnSelector
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
