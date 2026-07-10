import { FismaSystemType } from '@/types'
import {
  DataGrid,
  GridColDef,
  GridFooterContainer,
  GridSlotsComponentsProps,
  GridRenderCellParams,
  GridActionsCellItem,
  GridToolbarQuickFilter,
  GridFooter,
  GridRowId,
  useGridApiRef,
  GridRowParams,
} from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import {
  Box,
  IconButton,
  Checkbox,
  FormControl,
  Select,
  MenuItem,
  ListItemText,
  Button,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useState, useEffect, useMemo } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import FileDownloadSharpIcon from '@mui/icons-material/FileDownloadSharp'
import QuestionnareModal from '../QuestionnareModal/QuestionnareModal'
import CustomSnackbar from '../Snackbar/Snackbar'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { useNavigate, Link } from 'react-router-dom'
import { RouteNames } from '@/router/constants'
import { ERROR_MESSAGES } from '../../constants'
import { isAuthHandled } from '@/utils/notify'
import VisibilityIcon from '@mui/icons-material/Visibility'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import BarChartIcon from '@mui/icons-material/BarChart'
import PillarScoresModal from '../../components/PillarScoresModal/PillarScoresModal'
// import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import { FismaTableProps } from '@/types'
import type { ScoreAggregate, SystemScoreEntry } from '@/types'
import { hasSystemAccess } from '@/utils/userRoles'
import { cellStyleForTier } from '@/utils/tierStyles'
import { ProgressCell } from './progressColumn'
import { progressSortValue } from './progressHelpers'
import { fetchOpDivs } from '@/utils/opdivs'
import { toCategoryMap } from '@/utils/dataCenterEnvironments'
import type { OpDiv } from '@/types'
import {
  applyDashboardFilters,
  hasNoActiveFilters,
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from './dashboardFilters'
type selectedRowsType = GridRowId[]
type OpDivOption = { id: number; label: string }
declare module '@mui/x-data-grid' {
  interface FooterPropsOverrides {
    selectedRows: selectedRowsType
    fismaSystems: FismaSystemType[]
    activeDataCallId: number
    scores: Record<number, SystemScoreEntry>
    systemCallMap?: Record<number, number[]>
  }
  interface ToolbarPropsOverrides {
    filters: DashboardFilterState
    onFiltersChange: (next: DashboardFilterState) => void
    envOptions: string[]
    opdivOptions: OpDivOption[]
    showEnvFilter: boolean
    showOpDivFilter: boolean
  }
}

export function CustomFooterSaveComponent(
  props: NonNullable<GridSlotsComponentsProps['footer']>
) {
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false)
  const [snackBarSeverity, setSnackBarSeverity] = useState<
    'success' | 'error' | 'warning' | 'info'
  >('error')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const handleCloseSnackbar = () => {
    setOpenSnackbar(false)
  }
  // The export endpoint targets one data call. Derive it from the selected
  // rows' own call(s): if they all share one call, export that; an empty
  // provenance falls back to the active call; a selection that spans more than
  // one call has no single export target, so the button is disabled.
  const selectedCallIds = new Set<number>()
  const callMap = props.systemCallMap ?? {}
  for (const id of props.selectedRows ?? []) {
    for (const cid of callMap[id as number] ?? []) selectedCallIds.add(cid)
  }
  const exportCallId =
    selectedCallIds.size === 1
      ? [...selectedCallIds][0]
      : selectedCallIds.size === 0
        ? props.activeDataCallId
        : null
  const exportBlocked =
    !props.selectedRows ||
    props.selectedRows.length === 0 ||
    exportCallId === null
  const saveSystemAnswers = async () => {
    let exportUrl = `/datacalls/${exportCallId}/export`
    if (props.selectedRows && props.selectedRows.length > 0) {
      exportUrl += '?'
      let idString: string = ''
      props.selectedRows.forEach((id, index) => {
        idString += 'fsids=' + id
        if (props.selectedRows && index < props.selectedRows.length - 1) {
          idString += '&'
        }
      })
      exportUrl += idString
    }
    try {
      const response = await axiosInstance.get(exportUrl, {
        responseType: 'blob',
      })
      const [, filename] =
        response.headers['content-disposition'].split('filename=')
      const contentType = response.headers['content-type']
      const data = new Blob([response.data], {
        type: typeof contentType === 'string' ? contentType : undefined,
      })
      const url = window.URL.createObjectURL(data)
      const tempLink = document.createElement('a')
      tempLink.href = url
      tempLink.setAttribute('download', filename)
      tempLink.setAttribute('target', '_blank')
      tempLink.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      if (isAuthHandled(error)) return
      setErrorMessage(ERROR_MESSAGES.tryAgain)
      setSnackBarSeverity('warning')
      setOpenSnackbar(true)
    }
  }
  return (
    <>
      <GridFooterContainer>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 1,
            ml: 1,
            position: 'relative',
          }}
        >
          <Tooltip
            title={
              exportCallId === null
                ? 'Selected systems span more than one data call — narrow the selection or the data-call selector'
                : 'Download selected system answers'
            }
          >
            <span role="presentation">
              <IconButton
                sx={{ color: '#004297' }}
                onClick={saveSystemAnswers}
                disabled={exportBlocked}
                aria-label={`Download selected system answers${props.selectedRows && props.selectedRows.length > 0 ? ` (${props.selectedRows.length} selected)` : ' (no systems selected)'}`}
              >
                <FileDownloadSharpIcon />
              </IconButton>
            </span>
          </Tooltip>
          <span
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
            }}
          >
            {props.selectedRows && props.selectedRows.length > 0
              ? `${props.selectedRows.length} system${props.selectedRows.length === 1 ? '' : 's'} selected. Download button available.`
              : ''}
          </span>
        </Box>
        <GridFooter />
      </GridFooterContainer>
      <CustomSnackbar
        open={openSnackbar}
        handleClose={handleCloseSnackbar}
        severity={snackBarSeverity}
        text={errorMessage}
        duration={4000}
      />
    </>
  )
}

function QuickSearchToolbar(props: {
  filters?: DashboardFilterState
  onFiltersChange?: (next: DashboardFilterState) => void
  envOptions?: string[]
  opdivOptions?: OpDivOption[]
  showEnvFilter?: boolean
  showOpDivFilter?: boolean
}) {
  const { showDecommissioned, setShowDecommissioned } = useContextProp()
  const filters = props.filters ?? EMPTY_DASHBOARD_FILTERS
  const onFiltersChange = props.onFiltersChange ?? (() => {})
  const envOptions = props.envOptions ?? []
  const opdivOptions = props.opdivOptions ?? []
  const showEnvFilter = props.showEnvFilter ?? false
  const showOpDivFilter = props.showOpDivFilter ?? false

  const switchSx = {
    '& .MuiSwitch-switchBase.Mui-checked': { color: '#004297' },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
      backgroundColor: '#004297',
    },
  }
  // Keep the collapsed value on a single line so a multi-select never grows the
  // control's height — the summary ellipsizes instead of wrapping into chips.
  const selectValueSx = {
    '& .MuiSelect-select': {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  }

  return (
    <Box
      sx={{
        py: 1,
        px: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <GridToolbarQuickFilter
        debounceMs={250}
        sx={{
          '& .MuiInputBase-input::placeholder': {
            color: '#404040',
            opacity: 0.8,
          },
          '& .MuiInputBase-root:after': {
            borderBottomColor: '#5666b8',
          },
          '& .MuiInputBase-root:hover:not(.Mui-disabled):before': {
            borderBottomColor: '#5666b8',
          },
        }}
      />
      {/* All facet filters live in one right-aligned cluster next to the
          Show Decommissioned toggle. */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {showEnvFilter && (
          <FormControl size="small" sx={{ width: 200 }}>
            <Select
              multiple
              displayEmpty
              value={filters.environments}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  environments: e.target.value as string[],
                })
              }
              inputProps={{ 'aria-label': 'Filter by environment' }}
              renderValue={(selected) => {
                const vals = selected as string[]
                if (vals.length === 0)
                  return <span style={{ color: '#6b6b6b' }}>Environment</span>
                if (vals.length === 1) return vals[0]
                return `${vals.length} environments`
              }}
              sx={selectValueSx}
            >
              {envOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Checkbox
                    checked={filters.environments.includes(opt)}
                    size="small"
                  />
                  <ListItemText primary={opt} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {showOpDivFilter && (
          <FormControl size="small" sx={{ width: 200 }}>
            <Select
              multiple
              displayEmpty
              value={filters.opdivIds}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  opdivIds: e.target.value as number[],
                })
              }
              inputProps={{ 'aria-label': 'Filter by OpDiv' }}
              renderValue={(selected) => {
                const ids = selected as number[]
                if (ids.length === 0)
                  return <span style={{ color: '#6b6b6b' }}>OpDiv</span>
                if (ids.length === 1)
                  return (
                    opdivOptions.find((o) => o.id === ids[0])?.label ??
                    String(ids[0])
                  )
                return `${ids.length} OpDivs`
              }}
              sx={selectValueSx}
            >
              {opdivOptions.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  <Checkbox
                    checked={filters.opdivIds.includes(o.id)}
                    size="small"
                  />
                  <ListItemText primary={o.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControlLabel
          control={
            <Switch
              checked={filters.notUpdatedOnly}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  notUpdatedOnly: e.target.checked,
                })
              }
              sx={switchSx}
            />
          }
          label="Not updated only"
          sx={{ m: 0 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={showDecommissioned}
              onChange={(e) => setShowDecommissioned(e.target.checked)}
              sx={switchSx}
            />
          }
          label="Show Decommissioned"
          sx={{ m: 0 }}
        />
        <Button
          size="small"
          startIcon={<CloseIcon />}
          onClick={() => onFiltersChange(EMPTY_DASHBOARD_FILTERS)}
          disabled={hasNoActiveFilters(filters)}
          sx={{ color: '#004297', textTransform: 'none', mr: 2, flexShrink: 0 }}
        >
          Clear filters
        </Button>
      </Box>
    </Box>
  )
}
// Cache for pillar scores to avoid repeated API calls
interface CachedScore {
  data: ScoreAggregate[]
  timestamp: number
}
const pillarScoresCache = new Map<number, CachedScore>()

export default function FismaTable({
  scores,
  progress,
  systemCallMap = {},
}: FismaTableProps) {
  const apiRef = useGridApiRef()
  const {
    fismaSystems,
    latestDataCallId,
    selectedDatacall,
    datacalls,
    userInfo,
    datacenterEnvironments,
  } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const hasSystemDetailAccess = hasSystemAccess(userInfo)
  const [open, setOpen] = useState<boolean>(false)
  const [selectedRow, setSelectedRow] = useState<FismaSystemType | null>(null)
  const [selectedRows, setSelectedRows] = useState<GridRowId[]>([])
  const [filters, setFilters] = useState<DashboardFilterState>(
    EMPTY_DASHBOARD_FILTERS
  )
  const [opdivs, setOpDivs] = useState<OpDiv[]>([])
  const navigate = useNavigate()

  // OpDiv list is only needed to label the OpDiv filter. Include inactive
  // OpDivs so a system tied to a since-deactivated OpDiv still shows a name,
  // not a bare id. Fetched once; failure is non-fatal.
  useEffect(() => {
    const controller = new AbortController()
    fetchOpDivs(true, controller.signal)
      .then(setOpDivs)
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Fetch opdivs error:', error)
      })
    return () => controller.abort()
  }, [])

  // Raw datacenterenvironment -> category label, from the vocabulary already in
  // context. Drives both the Environment filter options and row matching.
  const categoryMap = useMemo(
    () => toCategoryMap(datacenterEnvironments),
    [datacenterEnvironments]
  )

  // Only offer facet values that actually appear in the current rows, in the
  // vocabulary's curated order (datacenterEnvironments arrives sorted by `ordr`)
  // so the filter matches the system-form dropdown order rather than alphabetical.
  const envOptions = useMemo(() => {
    const present = new Set<string>()
    for (const system of fismaSystems) {
      const category = categoryMap[system.datacenterenvironment]
      if (category) present.add(category)
    }
    const ordered: string[] = []
    const seen = new Set<string>()
    for (const dce of datacenterEnvironments) {
      if (present.has(dce.category) && !seen.has(dce.category)) {
        seen.add(dce.category)
        ordered.push(dce.category)
      }
    }
    return ordered
  }, [fismaSystems, categoryMap, datacenterEnvironments])

  const opdivOptions = useMemo<OpDivOption[]>(() => {
    const byId = new Map(opdivs.map((o) => [o.opdiv_id, o]))
    const present = new Set<number>()
    for (const system of fismaSystems) {
      if (system.opdiv_id != null) present.add(system.opdiv_id)
    }
    return Array.from(present)
      .map((id) => {
        const od = byId.get(id)
        return { id, label: od ? `${od.code} — ${od.name}` : String(id) }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [fismaSystems, opdivs])

  // Hide a facet filter when the visible systems span a single value — the
  // control gains nothing and only costs toolbar width (and an empty menu).
  const showEnvFilter = envOptions.length > 1
  const showOpDivFilter = opdivOptions.length > 1

  // Keep selections valid as the option sets change (e.g. Show Decommissioned
  // refetches the rows, or a filter hides). Drop any selected value no longer
  // offered so the grid never over-filters via an invisible control and MUI
  // never warns about a value outside its options.
  useEffect(() => {
    setFilters((prev) => {
      const environments = showEnvFilter
        ? prev.environments.filter((e) => envOptions.includes(e))
        : []
      const opdivIds = showOpDivFilter
        ? prev.opdivIds.filter((id) => opdivOptions.some((o) => o.id === id))
        : []
      if (
        environments.length === prev.environments.length &&
        opdivIds.length === prev.opdivIds.length
      ) {
        return prev
      }
      return { ...prev, environments, opdivIds }
    })
  }, [envOptions, opdivOptions, showEnvFilter, showOpDivFilter])

  const filteredRows = useMemo(
    () =>
      applyDashboardFilters(fismaSystems, progress ?? {}, categoryMap, filters),
    [fismaSystems, progress, categoryMap, filters]
  )
  const [pillarScoresModal, setPillarScoresModal] = useState<{
    open: boolean
    systemName: string
    systemAcronym: string
    fismasystemid: number
    scores: ScoreAggregate[]
  }>({
    open: false,
    systemName: '',
    systemAcronym: '',
    fismasystemid: 0,
    scores: [],
  })
  const handleCloseModal = () => {
    setOpen(false)
    setSelectedRow(null)
  }

  const handleOpenPillarScores = async (row: FismaSystemType) => {
    try {
      // Check cache first
      const cached = pillarScoresCache.get(row.fismasystemid)
      const now = Date.now()
      const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

      let scoresData
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        // Use cached data
        scoresData = cached.data
      } else {
        // Fetch fresh data
        const response = await axiosInstance.get(
          `/scores/aggregate?fismasystemid=${row.fismasystemid}&include_pillars=true`
        )
        scoresData = response.data.data

        // Store in cache
        pillarScoresCache.set(row.fismasystemid, {
          data: scoresData,
          timestamp: now,
        })
      }

      setPillarScoresModal({
        open: true,
        systemName: row.fismaname,
        systemAcronym: row.fismaacronym,
        fismasystemid: row.fismasystemid,
        scores: scoresData,
      })
    } catch (error) {
      console.error('Error fetching pillar scores:', error)
    }
  }

  const handleClosePillarScores = () => {
    setPillarScoresModal((prev) => ({ ...prev, open: false }))
  }
  const columns: GridColDef[] = [
    {
      field: 'fismaname',
      headerName: 'System Name',
      flex: 2,
      minWidth: 300,
      maxWidth: 450,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Link
          to={`/systems/${params.row.fismasystemid}`}
          style={{ color: '#004297', textDecoration: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {params.value}
        </Link>
      ),
    },
    {
      field: 'fismaacronym',
      headerName: 'Acronym',
      flex: 0.8,
      minWidth: 100,
    },
    {
      // Bound directly to the backend-resolved isso_name (populated for both
      // CMS and HHS systems). Replaces the old issoemail.split('@') derivation,
      // which rendered blank for HHS systems and crashed the sort on null
      // emails (ztmf-ui#450).
      field: 'isso_name',
      headerName: 'ISSO Name',
      flex: 1.2,
      minWidth: 120,
      maxWidth: 240,
      hideable: false,
      valueGetter: (value) => value.row.isso_name ?? '',
      renderCell: (params) => params.row.isso_name || '—',
    },
    {
      field: 'fips',
      headerName: 'FIPS',
      flex: 0.8,
      minWidth: 100,
      valueGetter: (value) => value.row.fips ?? '',
      renderCell: (params) => params.row.fips || '—',
    },
    {
      field: 'Score',
      headerName: 'Zero Trust Score',
      type: 'number',
      width: 160,
      align: 'center',
      headerAlign: 'center',
      hideable: false,
      valueGetter: (value) => {
        const entry = scores[value.row.fismasystemid]
        if (!entry || !entry.score) {
          return 0
        }
        return entry.score.toFixed(2)
      },
      renderCell: (params) => {
        const entry = scores[params.row.fismasystemid]
        const score = entry?.score ?? 0
        // Tier comes from the backend on /scores/aggregate; do not derive
        // it from the numeric score. Cells without a tier render with no
        // background fill so a transient deploy mismatch reads as
        // "unknown" rather than a misleading color.
        const backgroundColor =
          cellStyleForTier(entry?.tier)?.backgroundColor ?? 'transparent'
        return (
          <Box
            sx={{
              border: 1,
              p: 1,
              px: 4,
              borderRadius: 2,
              borderColor: 'darkgray',
              backgroundColor,
            }}
          >
            {score.toFixed(2)}
          </Box>
        )
      },
    },
    {
      // Questionnaire progress for the active data call (ztmf#299). The
      // fraction counts answers genuinely edited this cycle - answers
      // pre-populated from the previous data call do not count until a
      // user saves them. Ascending sort is the triage order: not-updated
      // systems first, then by completion fraction.
      field: 'datacallprogress',
      headerName: 'Data Call Progress',
      // valueGetter returns a numeric sort key, so the column must sort as a
      // number - otherwise the grid string-compares and "1.5" sorts before
      // "-1". type: 'number' also right-aligns by default, overridden below.
      type: 'number',
      width: 190,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (value) =>
        progressSortValue(progress?.[value.row.fismasystemid]),
      renderCell: (params) => (
        <ProgressCell entry={progress?.[params.row.fismasystemid]} />
      ),
    },
    {
      field: 'datacenterenvironment',
      headerName: 'Data Center Environment',
      flex: 1.5,
      minWidth: 180,
      hideable: false,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      headerAlign: 'center',
      align: 'center',
      width: 140,
      minWidth: 140,
      hideable: false,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams) => {
        // Each system belongs to one call, so the questionnaire opens that
        // system's own call. A system with data in more than one active call
        // is genuinely ambiguous and is gated until the selector is narrowed.
        const rowCalls = systemCallMap[params.row.fismasystemid] ?? []
        const questionnaireAmbiguous = rowCalls.length > 1
        const rowCallId = rowCalls[0] ?? activeDataCallId
        const rowCall = datacalls.find((d) => d.datacallid === rowCallId)
        return (
          <>
            <Tooltip
              title={
                questionnaireAmbiguous
                  ? 'This system has more than one data call this year — pick a single call in the selector to open its questionnaire'
                  : 'Questionnaire'
              }
            >
              <span>
                <GridActionsCellItem
                  icon={<QuestionAnswerOutlinedIcon />}
                  key={`question-${params.row.fismasystemid}`}
                  label={`View Questionnaire for ${params.row.fismaname}`}
                  className="textPrimary"
                  role="button"
                  disabled={questionnaireAmbiguous}
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(
                      `/${RouteNames.QUESTIONNAIRE}/${params.row.fismaacronym.toLowerCase()}`,
                      {
                        state: {
                          fismasystemid: params.row.fismasystemid,
                          datacallid: rowCallId,
                          datacall: rowCall?.datacall,
                        },
                      }
                    )
                  }}
                  color="inherit"
                />
              </span>
            </Tooltip>
            <Tooltip title="Pillar Scores">
              <span>
                <GridActionsCellItem
                  icon={<BarChartIcon />}
                  key={`chart-${params.row.fismasystemid}`}
                  label={`View Pillar Scores for ${params.row.fismaname}`}
                  className="textPrimary"
                  role="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpenPillarScores(params.row as FismaSystemType)
                  }}
                  color="inherit"
                />
              </span>
            </Tooltip>
            {hasSystemDetailAccess && (
              <Tooltip title="System Details">
                <span>
                  <GridActionsCellItem
                    icon={<VisibilityIcon />}
                    key={`view-${params.row.fismasystemid}`}
                    label={`View system details for ${params.row.fismaname}`}
                    className="textPrimary"
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
        )
      },
    },
  ]

  return (
    <Box sx={{ height: 600, width: '100%', mb: 2 }}>
      <DataGrid
        rows={filteredRows}
        isRowSelectable={(params: GridRowParams) =>
          params.row.fismasystemid in scores
        }
        columns={columns}
        checkboxSelection
        apiRef={apiRef}
        getRowId={(row) => row.fismasystemid}
        onRowSelectionModelChange={(ids) => {
          const selectedIDs = Array.from(ids)
          setSelectedRows(selectedIDs)
        }}
        slotProps={{
          footer: {
            selectedRows,
            fismaSystems,
            activeDataCallId,
            scores,
            systemCallMap,
          },
          toolbar: {
            filters,
            onFiltersChange: setFilters,
            envOptions,
            opdivOptions,
            showEnvFilter,
            showOpDivFilter,
          },
          filterPanel: {
            sx: {
              '& .MuiFormLabel-root': {
                marginTop: 1,
              },
            },
          },
        }}
        slots={{
          toolbar: QuickSearchToolbar,
          footer: CustomFooterSaveComponent,
        }}
        disableColumnFilter
        disableColumnSelector
        disableDensitySelector
        sx={{
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#004297',
            color: '#fff',
          },
          '& .MuiDataGrid-menuIconButton': {
            color: '#fff',
          },
          '& .MuiDataGrid-menuIcon': {
            color: '#fff',
          },
          '& .MuiDataGrid-sortIcon': {
            color: '#fff',
          },
          '& .MuiFormControl-root.MuiTextField-root': {
            marginTop: 0,
          },
          '& .MuiTablePagination-selectLabel': {
            marginBottom: 2,
          },
          '& .MuiTablePagination-displayedRows': {
            marginBottom: 2,
          },
          '& .MuiDataGrid-columnHeaders .MuiSvgIcon-root': {
            color: 'white',
          },
        }}
      />
      <QuestionnareModal
        open={open}
        onClose={handleCloseModal}
        system={selectedRow}
      />
      <PillarScoresModal
        open={pillarScoresModal.open}
        onClose={handleClosePillarScores}
        systemName={pillarScoresModal.systemName}
        systemAcronym={pillarScoresModal.systemAcronym}
        scores={pillarScoresModal.scores}
        selectedDataCallId={activeDataCallId}
      />
    </Box>
  )
}
