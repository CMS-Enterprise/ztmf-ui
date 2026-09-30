import FismaTable from '../FismaTable/FismaTable'
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
import { isAdmin as checkIsAdmin, isSystemDelegate } from '@/utils/userRoles'
import MySystemsBand from '../MySystems/MySystemsBand'
import { isAuthHandled, notify } from '@/utils/notify'
import { ERROR_MESSAGES } from '@/constants'
import { colors } from '@/theme/tokens'
import _ from 'lodash'
import type { FismaSystemType } from '@/types'
import { buildDashboardMaps } from './aggregateScores'
import { deriveExportCallId } from './exportCall'

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
  // Everyone gets the band, so the dashboard reads the same whoever opens it.
  // The band describes whatever /fismasystems returned for this caller, which
  // the backend has already narrowed: an ISSO's assignments, an OpDiv admin's
  // OpDiv, an HHS admin's estate. Admins who want per-OpDiv depth go to the
  // OpDiv dashboard, which is built for it.
  //
  // A delegate is answers-only and cannot set a target maturity, so the target
  // worklist is withheld from them rather than offering a backlog they 403 on.
  const hideTargets = isSystemDelegate(userInfo)

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

      {/* Replaces the old stat tiles for everyone. Those described an estate -
          highest, lowest, how many at Optimal - which answered nothing for a
          reader holding three systems and little more for one holding a
          thousand. This says what needs action instead, at whatever scope the
          caller has. */}
      <MySystemsBand hideTargets={hideTargets} />
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
