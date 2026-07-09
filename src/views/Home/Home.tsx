import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { Box, CircularProgress } from '@mui/material'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import type { ScoreAggregate, ScoreProgress, SystemScoreEntry } from '@/types'
/**
 * Component that renders the contents of the Home view.
 * @returns {JSX.Element} Component that renders the home contents.
 */

export default function HomePageContainer() {
  const [loading, setLoading] = useState<boolean>(true)
  const [scoreMap, setScoreMap] = useState<Record<number, SystemScoreEntry>>({})
  const [progressMap, setProgressMap] = useState<Record<number, ScoreProgress>>(
    {}
  )
  const { latestDataCallId, selectedDatacall } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
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
    // Questionnaire progress for the active data call (ztmf#299). Fetched
    // alongside the aggregate but independent of it: a failure here leaves
    // the progress column as em-dashes without blocking the score display,
    // so it neither gates `loading` nor shares the aggregate's try/catch.
    async function fetchProgress() {
      if (activeDataCallId !== 0) {
        try {
          const res = await axiosInstance.get(
            `/scores/progress?datacallid=${activeDataCallId}`,
            { signal: controller.signal }
          )
          const map: Record<number, ScoreProgress> = {}
          for (const obj of res.data.data as ScoreProgress[]) {
            map[obj.fismasystemid] = obj
          }
          setProgressMap(map)
        } catch (error) {
          if (controller.signal.aborted) return
          console.error('Error fetching data call progress:', error)
          setProgressMap({})
        }
      }
    }
    fetchScores()
    fetchProgress()
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
    <Box>
      <StatisticsBlocks scores={scoreMap} />
      <BreadCrumbs />
      <FismaTable scores={scoreMap} progress={progressMap} />
    </Box>
  )
}
