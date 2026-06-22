import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { Box, CircularProgress } from '@mui/material'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import type { ScoreAggregate, SystemScoreEntry } from '@/types'
/**
 * Component that renders the contents of the Home view.
 * @returns {JSX.Element} Component that renders the home contents.
 */

export default function HomePageContainer() {
  const [loading, setLoading] = useState<boolean>(true)
  const [scoreMap, setScoreMap] = useState<Record<number, SystemScoreEntry>>({})
  const { latestDataCallId, selectedDatacall } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  useEffect(() => {
    async function fetchScores() {
      if (activeDataCallId !== 0) {
        try {
          const res = await axiosInstance.get(
            `/scores/aggregate?datacallid=${activeDataCallId}`
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
          console.error('Error fetching scores:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    fetchScores()
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
    <Box>
      <StatisticsBlocks scores={scoreMap} />
      <BreadCrumbs />
      <FismaTable scores={scoreMap} />
    </Box>
  )
}
