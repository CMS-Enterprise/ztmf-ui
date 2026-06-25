import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { Box, CircularProgress } from '@mui/material'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import PageHeader from '@/components/ds/PageHeader'
import type { ScoreAggregate, SystemScoreEntry } from '@/types'
/**
 * Component that renders the contents of the Home view.
 * @returns {JSX.Element} Component that renders the home contents.
 */

export default function HomePageContainer() {
  const [loading, setLoading] = useState<boolean>(true)
  const [scoreMap, setScoreMap] = useState<Record<number, SystemScoreEntry>>({})
  const { latestDataCallId, selectedDatacall, fismaSystems } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const datacallName = selectedDatacall?.datacall ?? ''
  const systemCount = fismaSystems.length
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

  if (loading) {
    return (
      <Box
        sx={{
          height: '100vh', // or any specific height
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
      />
      <StatisticsBlocks scores={scoreMap} />
      <FismaTable scores={scoreMap} />
    </Box>
  )
}
