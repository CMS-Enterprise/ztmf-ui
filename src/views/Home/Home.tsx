import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/keys'
import { useDashboardScores, scoreAggregateQuery } from '@/utils/scores'
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
    datacallsLoaded,
    activeDatacallIds,
    fismaSystems,
    userInfo,
    datacenterEnvironments,
    opdivs,
  } = useContextProp()
  const queryClient = useQueryClient()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const datacallName = selectedDatacall?.datacall ?? ''
  const systemCount = fismaSystems.length
  const isAdmin = checkIsAdmin(userInfo)

  const { scoresPerCall, progressPerCall, loading } =
    useDashboardScores(activeDatacallIds)
  // Merged per system, choosing the call each system most recently updated.
  // Scores and progress are merged together because the chosen call depends
  // on both.
  const { scoreMap, progressMap, systemCallMap, chosenCallMap } = useMemo(
    () => buildDashboardMaps(activeDatacallIds, scoresPerCall, progressPerCall),
    [activeDatacallIds, scoresPerCall, progressPerCall]
  )

  // Average score for the immediately-prior datacall, for the Avg ZT trend.
  // datacalls arrives deadline-sorted (newest first), so the prior call is
  // the next entry after the active one - NOT the next-lower datacallid,
  // which historical loads can out-id (#393).
  const priorCall = useMemo(() => {
    const activeIdx = datacalls.findIndex(
      (dc) => dc.datacallid === activeDataCallId
    )
    return activeIdx >= 0 ? datacalls[activeIdx + 1] : undefined
  }, [datacalls, activeDataCallId])
  // Same key the fan-out above uses, so when the prior call is also switched
  // on the two share one request instead of asking for the same aggregate
  // twice. A failure just hides the trend.
  const priorQuery = useQuery({
    ...scoreAggregateQuery(priorCall?.datacallid ?? 0),
    enabled: priorCall !== undefined,
  })
  const priorAvg =
    priorCall && priorQuery.data ? averageScore(priorQuery.data) : undefined
  const priorLabel =
    priorCall && priorQuery.data ? shortFy(priorCall.datacall) : ''

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

  // Mirrors the header Add-system flow. The list is refetched rather than
  // having the modal's record spliced in, so the row shown is the one the
  // server stored, with whatever it derived on write.
  const handleCloseAdd = (newRowData: FismaSystemType) => {
    if (!_.isEqual(EMPTY_SYSTEM, newRowData)) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fismaSystems.lists(),
      })
    }
    setAddOpen(false)
  }

  // The data calls decide which scores to ask for, so an empty selection
  // before they land is not an answer. Rendering then would show every system
  // unscored for a moment, then flip to the spinner once the ids arrive.
  if (!datacallsLoaded || loading) {
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
        progress={progressMap}
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
        // The modal's owning-OpDiv selector is required and lists these
        // (active only); without them it renders empty and blocks the save.
        opdivs={opdivs}
      />
    </Box>
  )
}
