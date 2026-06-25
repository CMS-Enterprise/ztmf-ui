import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import {
  Box,
  Button,
  CircularProgress,
  Autocomplete,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import PageHeader from '@/components/ds/PageHeader'
import { StatusChip } from '@/components/ds/StatusChip'
import EditSystemModal from '../EditSystemModal/EditSystemModal'
import { EMPTY_SYSTEM } from '../EditSystemModal/emptySystem'
import { exportSystemAnswers } from '@/utils/exportSystems'
import { isAdmin as checkIsAdmin } from '@/utils/userRoles'
import { isAuthHandled, notify } from '@/utils/notify'
import { ERROR_MESSAGES } from '@/constants'
import { colors } from '@/theme/tokens'
import _ from 'lodash'
import type { ScoreAggregate, SystemScoreEntry, FismaSystemType } from '@/types'

/** Formats an ISO date string as e.g. "May 1, 2026". */
function formatDate(value: string | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
  const [addOpen, setAddOpen] = useState<boolean>(false)
  const {
    latestDataCallId,
    selectedDatacall,
    setSelectedDatacall,
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

  const handleExport = async () => {
    if (!activeDataCallId) return
    setExporting(true)
    try {
      await exportSystemAnswers(activeDataCallId)
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

  const isClosed = selectedDatacall
    ? new Date() > new Date(selectedDatacall.deadline)
    : false

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
    <Box sx={{ py: 4 }}>
      <PageHeader
        title="Dashboard"
        subtitle={
          datacallName
            ? `Viewing ${datacallName} - ${systemCount} ${
                systemCount === 1 ? 'system' : 'systems'
              }`
            : `${systemCount} ${systemCount === 1 ? 'system' : 'systems'}`
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
            >
              Export CSV
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

      {/* Datacall context card */}
      {datacalls.length > 0 && (
        <Box
          sx={{
            backgroundColor: colors.white,
            border: `1px solid ${colors.neutral200}`,
            borderRadius: 2.5,
            px: 4,
            py: 3,
            mb: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.neutral500,
            }}
          >
            Datacall
          </Typography>
          <Autocomplete
            size="small"
            options={datacalls}
            getOptionLabel={(dc) => dc.datacall}
            isOptionEqualToValue={(option, value) =>
              option.datacallid === value.datacallid
            }
            value={selectedDatacall ?? datacalls[0]}
            onChange={(_event, dc) => {
              if (dc) setSelectedDatacall(dc)
            }}
            disableClearable
            sx={{ minWidth: 300 }}
            renderInput={(params) => <TextField {...params} size="small" />}
          />
          <StatusChip
            label={isClosed ? 'Closed' : 'Active'}
            kind={isClosed ? 'neutral' : 'active'}
          />
          <Box
            sx={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 4,
              fontSize: 13,
              fontWeight: 500,
              color: colors.neutral500,
              flexWrap: 'wrap',
            }}
          >
            <span>
              Opens{' '}
              <strong style={{ color: colors.ink }}>
                {formatDate(selectedDatacall?.datecreated)}
              </strong>
            </span>
            <span>
              Closes{' '}
              <strong style={{ color: colors.ink }}>
                {formatDate(selectedDatacall?.deadline)}
              </strong>
            </span>
          </Box>
        </Box>
      )}

      <StatisticsBlocks scores={scoreMap} />
      <FismaTable scores={scoreMap} />

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
