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
import type { ScoreAggregate, SystemScoreEntry, FismaSystemType } from '@/types'

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
  const {
    latestDataCallId,
    selectedDatacall,
    datacalls,
    fismaSystems,
    setFismaSystems,
    userInfo,
  } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const datacallName = selectedDatacall?.datacall ?? ''
  const systemCount = fismaSystems.length
  const isAdmin = checkIsAdmin(userInfo)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchScores() {
      if (activeDataCallId !== 0) {
        try {
          const res = await axiosInstance.get(
            `/scores/aggregate?datacallid=${activeDataCallId}`,
            { signal: controller.signal }
          )
          const scoresMap: Record<number, SystemScoreEntry> = {}
          for (const obj of res.data.data as ScoreAggregate[]) {
            scoresMap[obj.fismasystemid] = {
              score: obj.systemscore ?? 0,
              tier: obj.systemtier,
            }
          }
          setScoreMap(scoresMap)
        } catch (error) {
          if (controller.signal.aborted) return
          console.error('Error fetching scores:', error)
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      }
    }
    fetchScores()
    return () => {
      controller.abort()
    }
  }, [activeDataCallId])

  // Average score for the immediately-prior datacall, for the Avg ZT trend.
  // datacalls arrives sorted by datacallid descending, so the prior one is the
  // first with a smaller id than the active datacall.
  useEffect(() => {
    const prior = datacalls.find((dc) => dc.datacallid < activeDataCallId)
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

  const handleExport = async () => {
    if (!activeDataCallId) return
    setExporting(true)
    try {
      // Selection drives scope: with rows selected, export just those; with
      // nothing selected, fall back to the full-datacall export.
      const scope = selectedRows.length > 0 ? selectedRows : undefined
      await exportSystemAnswers(activeDataCallId, scope)
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
        // Cap at main's height (not just min) so the FISMA table child with
        // flex: 1 + min-height: 0 is *bounded* and its internal scroll fires
        // instead of growing this column and triggering main's outer scroll.
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
              disabled={exporting || !activeDataCallId}
              // Title surfaces the scope so it isn't hidden behind the count.
              title={
                selectedRows.length > 0
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
      />

      <EditSystemModal
        title="Add"
        open={addOpen}
        onClose={handleCloseAdd}
        system={EMPTY_SYSTEM}
        mode="create"
      />
    </Box>
  )
}
