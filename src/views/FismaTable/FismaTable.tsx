import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridActionsCellItem,
  GridRowParams,
} from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import {
  Alert,
  Box,
  InputBase,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import { useNavigate, Link } from 'react-router-dom'
import { RouteNames } from '@/router/constants'
import { useContextProp } from '../Title/Context'
import VisibilityIcon from '@mui/icons-material/Visibility'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import BarChartIcon from '@mui/icons-material/BarChart'
import { FismaTableProps } from '@/types'
import type { OpDiv, datacall } from '@/types'
import { hasSystemAccess } from '@/utils/userRoles'
import { fetchOpDivs } from '@/utils/opdivs'
import { toCategoryMap } from '@/utils/dataCenterEnvironments'
import { parseDatacallName } from '@/utils/datacallGrouping'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import { ProgressCell } from './progressColumn'
import { progressSortValue } from './progressHelpers'
import { isNotUpdated, isOpenCallInView } from './dashboardFilters'
import { resolveRowCallId, datacallNameComparator } from './rowCall'
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
 * search box, environment filter, OpDiv filter, not-updated toggle and
 * decommissioned toggle on the right.
 */
function TableToolbar({
  count,
  search,
  setSearch,
  opdivs,
  opdivFilter,
  setOpDivFilter,
  envOptions,
  envFilter,
  setEnvFilter,
  notUpdatedOnly,
  setNotUpdatedOnly,
  openCallOnly,
  setOpenCallOnly,
  hasOpenCall,
  openCallInView,
  showDecommissioned,
  setShowDecommissioned,
}: {
  count: number
  search: string
  setSearch: (value: string) => void
  opdivs: OpDiv[]
  opdivFilter: number | 'all'
  setOpDivFilter: (value: number | 'all') => void
  envOptions: string[]
  envFilter: string | 'all'
  setEnvFilter: (value: string | 'all') => void
  notUpdatedOnly: boolean
  setNotUpdatedOnly: (value: boolean) => void
  openCallOnly: boolean
  setOpenCallOnly: (value: boolean) => void
  hasOpenCall: boolean
  openCallInView: boolean
  showDecommissioned: boolean
  setShowDecommissioned: (value: boolean) => void
}) {
  // Why the call-scoped toggles are grayed out, when they are: no call open
  // at all vs an open call outside the selected year. Empty while they apply
  // (an empty title suppresses the Tooltip).
  const callScopeHint = openCallInView
    ? ''
    : hasOpenCall
      ? 'The open data call is not in the selected view'
      : 'No data call is currently open'
  const compactAutocompleteSx = {
    '& .MuiInputBase-root': {
      height: 30,
      fontSize: 13,
      py: '0 !important',
    },
    '& .MuiAutocomplete-input': { py: '0 !important' },
  }
  return (
    <>
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
            flexWrap: 'wrap',
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
          {/* Environment facet only renders when the rows span more than one
            category - a single-value filter costs toolbar width for nothing. */}
          {envOptions.length > 1 && (
            <Autocomplete
              size="small"
              options={envOptions}
              value={envFilter === 'all' ? null : envFilter}
              onChange={(_event, env) => setEnvFilter(env ?? 'all')}
              sx={{ width: 170, ...compactAutocompleteSx }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="All environments"
                  inputProps={{
                    ...params.inputProps,
                    'aria-label': 'Filter by environment',
                  }}
                />
              )}
            />
          )}
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
            sx={{ width: 180, ...compactAutocompleteSx }}
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
          {/* Both call-scoped toggles gray out when the open call is not in
            view (ui#639): "Not updated only" is a current-cycle laggard
            signal with nothing to match, and "Open data call only" would
            empty the grid. The span wrappers keep the tooltips firing on the
            disabled controls. */}
          <Tooltip title={callScopeHint}>
            <span>
              <CompactSwitchLabel
                checked={openCallOnly}
                onChange={setOpenCallOnly}
                label="Open data call only"
                disabled={!openCallInView}
              />
            </span>
          </Tooltip>
          <Tooltip title={callScopeHint}>
            <span>
              <CompactSwitchLabel
                checked={notUpdatedOnly}
                onChange={setNotUpdatedOnly}
                label="Not updated only"
                disabled={!openCallInView}
              />
            </span>
          </Tooltip>
          <CompactSwitchLabel
            checked={showDecommissioned}
            onChange={setShowDecommissioned}
            label="Show decommissioned"
          />
        </Box>
      </Box>
      {/* Toolbar-row captions crowd the filter cluster and wrap it (ui#639),
          so the call-scope notice renders as its own slim banner between the
          filters and the column headers. */}
      {/* role="status" rather than MUI's default role="alert": this is a
          standing contextual notice, and an assertive role would interrupt
          screen readers at mount and on every year switch.

          The live region is the keyboard- and screen-reader-reachable
          counterpart of the disabled switches' hover tooltips, so it has to
          actually announce. That is why the wrapper stays mounted and only its
          contents change: a live region inserted into the DOM at the same
          moment as its text is generally not announced, so gating the region
          itself on the condition would have made it silent in exactly the
          cases it exists to cover. */}
      <Box role="status" aria-live="polite">
        {!openCallInView && (
          <Alert severity="info" sx={{ borderRadius: 0, py: 0 }}>
            {hasOpenCall
              ? 'The open data call is not in the selected view'
              : "No open data call; showing each system's most recently updated call"}
          </Alert>
        )}
      </Box>
    </>
  )
}

/**
 * The FISMA systems table on the dashboard. Renders the systems list with a
 * bar+value+tier score, the data-call progress cell (ztmf#299), OpDiv badge
 * and status chip, plus row actions to open the questionnaire, pillar scores,
 * and system detail. Search is shared with the header box; environment, OpDiv,
 * not-updated and decommissioned filters narrow the rows.
 * @param {FismaTableProps} props - Component props.
 * @returns {JSX.Element} The systems table card.
 */
export default function FismaTable({
  scores,
  selectedRows,
  onSelectionChange,
  progress,
  systemCallMap = {},
  chosenCallMap = {},
}: FismaTableProps) {
  // Selection mode is opt-in: the parent enables it by passing handlers. This
  // keeps the table usable on pages that don't surface an Export CSV action.
  const selectionEnabled =
    selectedRows !== undefined && onSelectionChange !== undefined
  const {
    fismaSystems,
    latestDataCallId,
    selectedDatacall,
    activeDatacallIds,
    datacalls,
    userInfo,
    datacenterEnvironments,
    showDecommissioned,
    setShowDecommissioned,
    dashboardSearch,
    setDashboardSearch,
  } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const hasSystemDetailAccess = hasSystemAccess(userInfo)
  const navigate = useNavigate()
  const [opdivs, setOpDivs] = useState<OpDiv[]>([])
  const [opdivFilter, setOpDivFilter] = useState<number | 'all'>('all')
  const [envFilter, setEnvFilter] = useState<string | 'all'>('all')
  const [notUpdatedOnly, setNotUpdatedOnly] = useState(false)
  const [openCallOnly, setOpenCallOnly] = useState(false)

  // "Latest by deadline" is not the same as "still open". Once the newest
  // call's deadline has passed there is no active cycle at all, so nothing is
  // "current" - every row must render past-call (Complete/Incomplete) rather
  // than the "0/40 Not updated" laggard framing (ztmf-ui#542).
  const latestDeadlinePassed = useMemo(() => {
    if (!latestDataCallId) return false
    const latest = datacalls.find((d) => d.datacallid === latestDataCallId)
    return latest ? new Date() > new Date(latest.deadline) : false
  }, [datacalls, latestDataCallId])

  // Whether the call a given row is displaying (chosen by most-recently-updated
  // in buildDashboardMaps) is the current/active one: the latest-by-deadline
  // call AND that call is still open. The Data Call Progress column's
  // current-cycle framing (the "0/40 Not updated" laggard chip and the
  // not-updated filter) only makes sense then; a past/closed call shows a
  // neutral Complete/Incomplete chip instead (ztmf#537). Rows without a chosen
  // call, or before latestDataCallId has loaded, keep the current rendering.
  // Agrees with resolveRowCallId (the Data Call column) by construction:
  // buildDashboardMaps fills chosenCallMap and systemCallMap for the same key
  // set, so a row is grayed iff its column names a non-open call. Keep the
  // two in step if either resolution changes.
  const isRowCurrentCall = useCallback(
    (fismasystemid: number): boolean => {
      const chosen = chosenCallMap[fismasystemid]
      if (!latestDataCallId || chosen == null) return true
      return chosen === latestDataCallId && !latestDeadlinePassed
    },
    [chosenCallMap, latestDataCallId, latestDeadlinePassed]
  )

  // Whether any data call is open at all, and whether that open call is part
  // of what the table is showing. The year picker can select a historical
  // group while a newer call is open; in that view no row is current, so the
  // call-scoped toggles ("Not updated only", "Open data call only") and the
  // past-call graying key on the viewed calls, not the calendar (ui#639).
  // Without the in-view check the first toggle silently empties the grid (the
  // reported bug) and the second keeps only rows with no call data.
  const hasOpenCall = Boolean(latestDataCallId) && !latestDeadlinePassed
  const openCallInView = isOpenCallInView(
    latestDataCallId,
    latestDeadlinePassed,
    activeDatacallIds
  )
  const callById = useMemo(
    () => new Map(datacalls.map((d) => [d.datacallid, d])),
    [datacalls]
  )
  // Sort key for the Data Call column: call names do not sort chronologically
  // ("FY2025 Q3" vs "FY25 ZTM"), so the column orders by deadline instead.
  const deadlineByCallName = useMemo(
    () =>
      new Map(
        datacalls.map((d) => [d.datacall, new Date(d.deadline).getTime()])
      ),
    [datacalls]
  )

  // The call-scoped facets only mean something while the open call is in
  // view (their switches gray out otherwise). Drop any stored true when it is
  // not, so a year-picker move to a historical group, or a /datacalls refetch
  // that flips the newest call closed, cannot leave an invisible filter
  // emptying the grid (ui#639). (openness is evaluated when datacalls load,
  // not continuously, so a deadline passing while the page sits open takes
  // effect on the next fetch or reload.)
  useEffect(() => {
    if (openCallInView) return
    setNotUpdatedOnly(false)
    setOpenCallOnly(false)
  }, [openCallInView])

  // When a system has scores in more than one active call, the questionnaire
  // button opens a small picker (#467) instead of guessing which call to open.
  const [callPicker, setCallPicker] = useState<{
    anchor: HTMLElement
    fismasystemid: number
    fismaacronym: string
    calls: datacall[]
  } | null>(null)
  const openQuestionnaire = (
    fismasystemid: number,
    fismaacronym: string,
    call: datacall | undefined
  ) => {
    navigate(`/${RouteNames.QUESTIONNAIRE}/${fismaacronym.toLowerCase()}`, {
      state: {
        fismasystemid,
        datacallid: call?.datacallid ?? activeDataCallId,
        datacall: call?.datacall,
        deadline: call?.deadline,
      },
    })
  }

  // OpDiv reference list, for both the filter dropdown and the code badges.
  // Include inactive OpDivs so a system tied to a since-deactivated OpDiv
  // still shows a name, not a bare id.
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

  // Raw datacenterenvironment -> category label, from the vocabulary in
  // context. Drives the Environment filter options, row matching, and the
  // Data center column labels. Falls back to the raw value until the
  // vocabulary loads or for any unmapped legacy value.
  const categoryMap = useMemo(
    () => toCategoryMap(datacenterEnvironments),
    [datacenterEnvironments]
  )
  const envLabel = useCallback(
    (raw: string | null | undefined): string =>
      raw ? categoryMap[raw] ?? raw : '',
    [categoryMap]
  )

  // Only offer facet values that actually appear in the rows, in the
  // vocabulary's curated order so the filter matches the system-form
  // dropdown order rather than alphabetical.
  const envOptions = useMemo(() => {
    const present = new Set<string>()
    for (const system of fismaSystems) {
      const category = envLabel(system.datacenterenvironment)
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
    // Raw values with no vocabulary mapping still appear as their own facet.
    for (const value of present) {
      if (!seen.has(value)) {
        seen.add(value)
        ordered.push(value)
      }
    }
    return ordered
  }, [fismaSystems, envLabel, datacenterEnvironments])

  // Drop a selected environment that is no longer offered (e.g. the
  // decommissioned toggle refetched the rows) so the grid never over-filters
  // via an invisible control.
  useEffect(() => {
    if (envFilter !== 'all' && !envOptions.includes(envFilter)) {
      setEnvFilter('all')
    }
  }, [envFilter, envOptions])

  const rows = useMemo(
    () =>
      fismaSystems.filter((s) => {
        if (openCallOnly && !isRowCurrentCall(s.fismasystemid)) return false
        if (opdivFilter !== 'all' && s.opdiv_id !== opdivFilter) return false
        if (
          envFilter !== 'all' &&
          envLabel(s.datacenterenvironment) !== envFilter
        )
          return false
        if (
          notUpdatedOnly &&
          !isNotUpdated(
            progress?.[s.fismasystemid],
            isRowCurrentCall(s.fismasystemid)
          )
        )
          return false
        return true
      }),
    [
      fismaSystems,
      opdivFilter,
      envFilter,
      envLabel,
      notUpdatedOnly,
      openCallOnly,
      progress,
      isRowCurrentCall,
    ]
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
      // Bound directly to the backend-resolved isso_name (populated for both
      // CMS and HHS systems). Replaces the old issoemail.split('@') derivation,
      // which rendered blank for HHS systems and crashed the sort on null
      // emails (ztmf-ui#450).
      field: 'isso_name',
      headerName: 'ISSO',
      flex: 1.1,
      minWidth: 140,
      valueGetter: (value) => value.row.isso_name ?? '',
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: colors.ink }}>
          {params.row.isso_name || '-'}
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
      // Sort/search on the reporting category (what the cell shows), not the
      // raw legacy value.
      valueGetter: (params) => envLabel(params.row.datacenterenvironment),
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
          {envLabel(params.row.datacenterenvironment) || '-'}
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
      // Which call the row is displaying (ui#639), named plainly so a
      // past-call row is identifiable and quick-searchable without relying
      // on the grayed styling.
      field: 'rowdatacall',
      headerName: 'Data Call',
      // Renders as the column-header tooltip: the resolution is not obvious
      // from the name (it is not simply "last completed call").
      description:
        "The data call this row's score and progress are shown from: the system's most recently updated call among the selected calls, or the newest selected call for a system with no data in them.",
      width: 130,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (value) =>
        callById.get(
          resolveRowCallId(
            value.row.fismasystemid,
            chosenCallMap,
            systemCallMap,
            datacalls,
            activeDataCallId,
            activeDatacallIds
          )
        )?.datacall ?? '',
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
          {params.value || '-'}
        </Typography>
      ),
      sortComparator: datacallNameComparator(deadlineByCallName),
    },
    {
      // Questionnaire progress for the row's data call (ztmf#299). The
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
        progressSortValue(
          progress?.[value.row.fismasystemid],
          isRowCurrentCall(value.row.fismasystemid)
        ),
      renderCell: (params) => (
        <ProgressCell
          entry={progress?.[params.row.fismasystemid]}
          isCurrentCall={isRowCurrentCall(params.row.fismasystemid)}
          hasScore={Boolean(scores[params.row.fismasystemid])}
        />
      ),
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
      renderCell: (params: GridRenderCellParams) => {
        // The system's own call(s) among the active ones, newest first. One
        // call opens directly; more than one opens a picker so the user
        // chooses which to open (#467).
        const rowCallObjs = sortDatacallsByDeadline(
          (systemCallMap[params.row.fismasystemid] ?? [])
            .map((id) => datacalls.find((d) => d.datacallid === id))
            .filter((d): d is datacall => Boolean(d))
        )
        return (
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
                    if (rowCallObjs.length > 1) {
                      setCallPicker({
                        anchor: event.currentTarget,
                        fismasystemid: params.row.fismasystemid,
                        fismaacronym: params.row.fismaacronym,
                        calls: rowCallObjs,
                      })
                      return
                    }
                    openQuestionnaire(
                      params.row.fismasystemid,
                      params.row.fismaacronym,
                      rowCallObjs[0] ??
                        datacalls.find((d) => d.datacallid === activeDataCallId)
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
                    navigate(
                      `/systems/${params.row.fismasystemid}/pillar-scores`
                    )
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
        )
      },
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
        envOptions={envOptions}
        envFilter={envFilter}
        setEnvFilter={setEnvFilter}
        notUpdatedOnly={notUpdatedOnly}
        setNotUpdatedOnly={setNotUpdatedOnly}
        openCallOnly={openCallOnly}
        setOpenCallOnly={setOpenCallOnly}
        hasOpenCall={hasOpenCall}
        openCallInView={openCallInView}
        showDecommissioned={showDecommissioned}
        setShowDecommissioned={setShowDecommissioned}
      />
      <Box sx={{ flex: 1, minHeight: 0, width: '100%', display: 'flex' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.fismasystemid}
          // De-emphasize rows displaying a closed call while the open call is
          // in view (ui#639). Only in that mixed view: between calls, or on a
          // historical year, every row is past-call and graying the whole grid
          // distinguishes nothing. The Data Call column carries the same state
          // as text.
          getRowClassName={(params) =>
            openCallInView && !isRowCurrentCall(params.row.fismasystemid)
              ? 'past-call-row'
              : ''
          }
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
            // De-emphasis must not dim interactive elements: whole-row
            // opacity would drop the name link, checkbox, and action icons
            // below WCAG contrast minima while they stay clickable. Tint the
            // row background only; cells that set their own text color (the
            // link, chips, score) keep full contrast, and the Data Call
            // column names the older call outright.
            '& .past-call-row': {
              backgroundColor: colors.neutral50,
            },
            '& .past-call-row .MuiDataGrid-cell': {
              color: colors.neutral500,
            },
          }}
        />
      </Box>
      <Menu
        anchorEl={callPicker?.anchor ?? null}
        open={Boolean(callPicker)}
        onClose={() => setCallPicker(null)}
        MenuListProps={{ 'aria-label': 'Open which data call' }}
      >
        <ListSubheader>Open which data call?</ListSubheader>
        {callPicker?.calls.map((call) => {
          const isClosed = new Date() > new Date(call.deadline)
          const deadlineLabel = new Date(call.deadline).toLocaleDateString(
            'en-US',
            { month: 'short', day: 'numeric', year: 'numeric' }
          )
          return (
            <MenuItem
              key={call.datacallid}
              onClick={() => {
                openQuestionnaire(
                  callPicker.fismasystemid,
                  callPicker.fismaacronym,
                  call
                )
                setCallPicker(null)
              }}
            >
              <ListItemText
                primary={`${call.datacall} - ${parseDatacallName(call.datacall).tenant}`}
                secondary={`${isClosed ? 'Closed' : 'Active'} - deadline ${deadlineLabel}`}
              />
            </MenuItem>
          )
        })}
      </Menu>
    </Box>
  )
}
