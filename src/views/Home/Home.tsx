import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { Box, Button, CircularProgress } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import PageHeader from '@/components/ui/PageHeader'
import DatacallContextCard from '@/components/DatacallContextCard/DatacallContextCard'
import EditSystemModal from '../EditSystemModal/EditSystemModal'
import { EMPTY_SYSTEM } from '../EditSystemModal/emptySystem'
import { exportSystemAnswers } from '@/utils/exportSystems'
import { isAdmin as checkIsAdmin } from '@/utils/userRoles'
import { isAuthHandled, notify } from '@/utils/notify'
import { ERROR_MESSAGES } from '@/constants'
import { colors } from '@/theme/tokens'
import _ from 'lodash'
import type {
  ScoreAggregate,
  ScoreProgress,
  SystemScoreEntry,
  FismaSystemType,
} from '@/types'
import { buildDashboardMaps } from './aggregateScores'

/** Short fiscal-year label, e.g. "FY2022 ..." -> "FY22". Falls back to the name. */
function shortFy(name: string | undefined): string {
  if (!name) return ''
  const match = name.match(/FY(\d{4})/i)
  return match ? `FY${match[1].slice(2)}` : name
}

/** Average of the systemscore values in a score aggregate response. */
function averageScore(aggregates: ScoreAggregate[]): number {
  let sum = 0
  let count = 0
  for (const a of aggregates) {
    if (a.systemscore) {
      sum += a.systemscore
      count += 1
    }
  }
  return count > 0 ? sum / count : 0
}

/**
 * Dashboard view: page header with export/add actions, the datacall context
 * card, summary statistics, and the FISMA systems table.
 * @returns {JSX.Element} The dashboard.
 */
export default function HomePageContainer() {
  const [loading, setLoading] = useState<boolean>(true)
  const [scoreMap, setScoreMap] = useState<Record<number, SystemScoreEntry>>({})
  const [exporting, setExporting] = useState<boolean>(false)
  // Lifted so the Export CSV action can scope itself to the user's selection.
  // Empty array (default) -> export every system in the active datacall, which
  // matches the prior "select nothing, export all" behavior.
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [addOpen, setAddOpen] = useState<boolean>(false)
  const [priorAvg, setPriorAvg] = useState<number | undefined>(undefined)
  const [priorLabel, setPriorLabel] = useState<string>('')
  const [progressMap, setProgressMap] = useState<Record<number, ScoreProgress>>(
    {}
  )
  // Which active call(s) each system has scores in, so per-row actions open the
  // system's own data call instead of a globally-selected one.
  const [systemCallMap, setSystemCallMap] = useState<Record<number, number[]>>(
    {}
  )
  const [chosenCallMap, setChosenCallMap] = useState<Record<number, number>>({})
  const {
    latestDataCallId,
    selectedDatacall,
    datacalls,
    activeDatacallIds,
    fismaSystems,
    setFismaSystems,
    userInfo,
    datacenterEnvironments,
  } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const datacallName = selectedDatacall?.datacall ?? ''
  const systemCount = fismaSystems.length
  const isAdmin = checkIsAdmin(userInfo)

  useEffect(() => {
    const controller = new AbortController()
    const ids = activeDatacallIds

    // Aggregate every active call in the year. Each call is fetched
    // independently (per-request .catch so one failure doesn't sink the batch
    // or block the others), then buildDashboardMaps merges them per system,
    // choosing the call each system most recently updated. Scores and progress
    // are fetched together because the chosen call depends on both.
    async function load() {
      const [scoresPerCall, progressPerCall] = await Promise.all([
        Promise.all(
          ids.map((id) =>
            axiosInstance
              .get(`/scores/aggregate?datacallid=${id}`, {
                signal: controller.signal,
              })
              .then((res) => res.data.data as ScoreAggregate[])
              .catch((error) => {
                if (!controller.signal.aborted)
                  console.error(`scores/aggregate ${id} failed:`, error)
                return [] as ScoreAggregate[]
              })
          )
        ),
        Promise.all(
          ids.map((id) =>
            axiosInstance
              .get(`/scores/progress?datacallid=${id}`, {
                signal: controller.signal,
              })
              .then((res) => res.data.data as ScoreProgress[])
              .catch((error) => {
                if (!controller.signal.aborted)
                  console.error(`scores/progress ${id} failed:`, error)
                return [] as ScoreProgress[]
              })
          )
        ),
      ])
      if (controller.signal.aborted) return
      const maps = buildDashboardMaps(ids, scoresPerCall, progressPerCall)
      setScoreMap(maps.scoreMap)
      setProgressMap(maps.progressMap)
      setSystemCallMap(maps.systemCallMap)
      setChosenCallMap(maps.chosenCallMap)
      setLoading(false)
    }

    // Keep the spinner until the active calls resolve - activeDatacallIds is
    // empty on the first paint while Title is still fetching /datacalls, so
    // don't clear loading (which would flash an empty dashboard) until there
    // are calls to fetch.
    if (ids.length > 0) {
      load()
    }
    return () => {
      controller.abort()
    }
  }, [activeDatacallIds])

  // Average score for the immediately-prior datacall, for the Avg ZT trend.
  // datacalls arrives deadline-sorted (newest first), so the prior call is
  // the next entry after the active one - NOT the next-lower datacallid,
  // which historical loads can out-id (#393).
  useEffect(() => {
    const activeIdx = datacalls.findIndex(
      (dc) => dc.datacallid === activeDataCallId
    )
    const prior = activeIdx >= 0 ? datacalls[activeIdx + 1] : undefined
    if (!prior) {
      setPriorAvg(undefined)
      setPriorLabel('')
      return
    }
    const controller = new AbortController()
    async function fetchPrior() {
      try {
        const res = await axiosInstance.get(
          `/scores/aggregate?datacallid=${prior!.datacallid}`,
          { signal: controller.signal }
        )
        setPriorAvg(averageScore(res.data.data as ScoreAggregate[]))
        setPriorLabel(shortFy(prior!.datacall))
      } catch {
        if (controller.signal.aborted) return
        // Non-fatal: the trend simply hides if the prior fetch fails.
        setPriorAvg(undefined)
        setPriorLabel('')
      }
    }
    fetchPrior()
    return () => {
      controller.abort()
    }
  }, [activeDataCallId, datacalls])

  // The export endpoint targets one data call. Derive it from the selected
  // rows' own call(s): if they all share one call, export that; an empty
  // selection falls back to the active call; a selection that spans more
  // than one call has no single export target, so the button is disabled.
  const selectedCallIds = new Set<number>()
  for (const id of selectedRows) {
    for (const cid of systemCallMap[id] ?? []) selectedCallIds.add(cid)
  }
  const exportCallId =
    selectedCallIds.size === 1
      ? [...selectedCallIds][0]
      : selectedCallIds.size === 0
        ? activeDataCallId
        : null

  const handleExport = async () => {
    if (!exportCallId) return
    setExporting(true)
    try {
      // Selection drives scope: with rows selected, export just those; with
      // nothing selected, fall back to the full-datacall export.
      const scope = selectedRows.length > 0 ? selectedRows : undefined
      await exportSystemAnswers(exportCallId, scope)
    } catch (error) {
      if (!isAuthHandled(error)) {
        notify(ERROR_MESSAGES.tryAgain, 'warning', { autoHideDuration: 4000 })
      }
    } finally {
      setExporting(false)
    }
  }

  // Mirrors the header Add-system flow: append the created system to the list
  // when the modal returns a real (non-empty) record.
  const handleCloseAdd = (newRowData: FismaSystemType) => {
    if (!_.isEqual(EMPTY_SYSTEM, newRowData)) {
      setFismaSystems((prev) => [...prev, newRowData])
    }
    setAddOpen(false)
  }

  if (loading) {
    return (
      <Box
        sx={{
          height: '60vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        pt: 3,
        pb: 4,
        // Natural document flow: the FISMA table renders at its full height
        // (autoHeight) and the page scrolls, pushing the CMS footer down.
        boxSizing: 'border-box',
      }}
    >
      <PageHeader
        title="Dashboard"
        subtitle={
          datacallName ? (
            <>
              Viewing{' '}
              <strong style={{ color: colors.ink }}>{datacallName}</strong> ·{' '}
              {systemCount} {systemCount === 1 ? 'system' : 'systems'}
            </>
          ) : (
            `${systemCount} ${systemCount === 1 ? 'system' : 'systems'}`
          )
        }
        breadcrumbs={<BreadCrumbs />}
        actions={
          <>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={handleExport}
              disabled={exporting || !exportCallId}
              // Title surfaces the scope so it isn't hidden behind the count.
              title={
                exportCallId === null
                  ? 'Selected systems span more than one data call - narrow the selection or the data-call picker'
                  : selectedRows.length > 0
                    ? `Export ${selectedRows.length} selected system${selectedRows.length === 1 ? '' : 's'}`
                    : 'Export all systems in the active datacall'
              }
            >
              {selectedRows.length > 0
                ? `Export CSV (${selectedRows.length})`
                : 'Export CSV'}
            </Button>
            {isAdmin && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setAddOpen(true)}
              >
                Add system
              </Button>
            )}
          </>
        }
      />

      <DatacallContextCard />

      <StatisticsBlocks
        scores={scoreMap}
        priorAvg={priorAvg}
        priorLabel={priorLabel}
      />
      <FismaTable
        scores={scoreMap}
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
        progress={progressMap}
        systemCallMap={systemCallMap}
        chosenCallMap={chosenCallMap}
      />

      <EditSystemModal
        title="Add"
        open={addOpen}
        onClose={handleCloseAdd}
        system={EMPTY_SYSTEM}
        mode="create"
        datacenterEnvironments={datacenterEnvironments}
      />
    </Box>
  )
}
