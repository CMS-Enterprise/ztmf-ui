import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useMemo } from 'react'
import { useDatacallAggregates, useDatacallProgress } from '@/api/scores'
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
import {
  isAdmin as checkIsAdmin,
  hasAdminRead,
  isSystemDelegate,
  isSystemScoped,
} from '@/utils/userRoles'
import MySystemsBand from '../MySystems/MySystemsBand'
import { isAuthHandled, notify } from '@/utils/notify'
import { ERROR_MESSAGES } from '@/constants'
import { colors } from '@/theme/tokens'
import _ from 'lodash'
import type { ScoreAggregate, FismaSystemType } from '@/types'
import { buildDashboardMaps } from './aggregateScores'
import { deriveExportCallId } from './exportCall'

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
  const [exporting, setExporting] = useState<boolean>(false)
  // Lifted so the Export CSV action can scope itself to the user's selection.
  // Empty array (default) -> export every system in the active datacall, which
  // matches the prior "select nothing, export all" behavior.
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [addOpen, setAddOpen] = useState<boolean>(false)
  const {
    latestDataCallId,
    selectedDatacall,
    datacalls,
    activeDatacallIds,
    fismaSystems,
    setFismaSystems,
    userInfo,
    datacenterEnvironments,
    opdivs,
  } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const datacallName = selectedDatacall?.datacall ?? ''
  const systemCount = fismaSystems.length
  const isAdmin = checkIsAdmin(userInfo)
  // Admin tiers keep the estate-wide tiles. The system-scoped tiers - ISSO and
  // ISSM, plus delegates, who work the same questionnaires - get the band.
  // hasAdminRead wins, so an OpDiv admin who also holds systems still sees the
  // summary their tier is built around.
  const showsMySystems =
    !hasAdminRead(userInfo) &&
    (isSystemScoped(userInfo) || isSystemDelegate(userInfo))

  // Aggregate every active call in the year, then merge per system, choosing
  // the call each system most recently updated. Scores and progress are read
  // together because the chosen call depends on both. A single call's failure
  // yields an empty list rather than sinking the batch - see useDatacallAggregates.
  const { scoresPerCall, isPending: scoresPending } =
    useDatacallAggregates(activeDatacallIds)
  const { progressPerCall, isPending: progressPending } =
    useDatacallProgress(activeDatacallIds)

  const { scoreMap, progressMap, systemCallMap, chosenCallMap } = useMemo(
    () => buildDashboardMaps(activeDatacallIds, scoresPerCall, progressPerCall),
    [activeDatacallIds, scoresPerCall, progressPerCall]
  )

  // The immediately-prior datacall, for the Avg ZT trend. datacalls arrives
  // deadline-sorted (newest first), so the prior call is the next entry after
  // the active one - NOT the next-lower datacallid, which historical loads can
  // out-id (#393).
  const priorCall = useMemo(() => {
    const activeIdx = datacalls.findIndex(
      (dc) => dc.datacallid === activeDataCallId
    )
    return activeIdx >= 0 ? datacalls[activeIdx + 1] : undefined
  }, [datacalls, activeDataCallId])

  // Its own query rather than part of the batch above: the prior call is not an
  // active call, so it is not in activeDatacallIds. Non-fatal - the trend
  // simply hides when this has not resolved.
  const { scoresPerCall: priorScores } = useDatacallAggregates(
    priorCall ? [priorCall.datacallid] : []
  )
  const priorRows = priorScores[0]
  const priorAvg =
    priorCall && priorRows && priorRows.length > 0
      ? averageScore(priorRows)
      : undefined
  const priorLabel = priorAvg === undefined ? '' : shortFy(priorCall?.datacall)

  // activeDatacallIds is [] on the first paint while Title is still fetching
  // /datacalls, which is not "loaded and empty" - hold the spinner through that
  // window too rather than flashing an empty dashboard.
  const loading =
    activeDatacallIds.length === 0 || scoresPending || progressPending

  // The single call the export targets, or null (button disabled) when the
  // selection spans more than one call. Derivation logic + rationale live in
  // exportCall.ts so the not-started fallback is unit-testable.
  const exportCallId = deriveExportCallId(
    selectedRows,
    systemCallMap,
    chosenCallMap,
    activeDataCallId
  )

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

      {/* The summary swaps by tier. An admin's stat tiles describe an estate -
          highest, lowest, how many at Optimal - which says nothing to someone
          holding three systems, so the system-scoped tiers get a band about
          what needs their action instead. */}
      {showsMySystems ? (
        <MySystemsBand hideTargets={isSystemDelegate(userInfo)} />
      ) : (
        <StatisticsBlocks
          scores={scoreMap}
          progress={progressMap}
          priorAvg={priorAvg}
          priorLabel={priorLabel}
        />
      )}
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
        // The modal's owning-OpDiv selector is required and lists these
        // (active only); without them it renders empty and blocks the save.
        opdivs={opdivs}
      />
    </Box>
  )
}
