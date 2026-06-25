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
import { colors } from '@/theme/tokens'

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
        gap: 2,
        px: 4.5,
        py: 3.5,
        borderBottom: `1px solid ${colors.neutral200}`,
        flexWrap: 'wrap',
      }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
        FISMA systems
      </Typography>
      <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
        {count} {count === 1 ? 'system' : 'systems'}
      </Typography>
      <Box
        sx={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            border: `1px solid ${colors.neutral200}`,
            borderRadius: 1,
          }}
        >
          <SearchIcon sx={{ fontSize: 14, color: colors.neutral500 }} />
          <InputBase
            placeholder="Search systems"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ fontSize: 13, width: 160 }}
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
          sx={{ minWidth: 130 }}
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
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ py: 1 }}>
          <Link
            to={`/systems/${params.row.fismasystemid}`}
            style={{
              color: colors.ink,
              fontWeight: 600,
              textDecoration: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {params.row.fismaname}
          </Link>
          {params.row.mission && (
            <Typography
              sx={{ fontSize: 12, color: colors.neutral500, mt: 0.25 }}
            >
              {params.row.mission}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'fismauid',
      headerName: 'FISMA ID',
      flex: 0.9,
      minWidth: 110,
      renderCell: (params) => (
        <Typography
          sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
        >
          {params.row.fismauid}
        </Typography>
      ),
    },
    {
      field: 'opdiv',
      headerName: 'OpDiv',
      flex: 0.8,
      minWidth: 100,
      valueGetter: (params) =>
        params.row.opdiv_id ? opdivCodeMap[params.row.opdiv_id] ?? '' : '',
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
                icon={<QuestionAnswerOutlinedIcon fontSize="small" />}
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
                icon={<BarChartIcon fontSize="small" />}
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
                  icon={<VisibilityIcon fontSize="small" />}
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
        borderRadius: 1.5,
        overflow: 'hidden',
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
      <Box sx={{ height: 560, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.fismasystemid}
          rowHeight={64}
          disableRowSelectionOnClick
          disableColumnSelector
          filterModel={{ items: [], quickFilterValues }}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          pageSizeOptions={[25, 50, 100]}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: colors.neutral50,
            },
          }}
        />
      </Box>
    </Box>
  )
}
