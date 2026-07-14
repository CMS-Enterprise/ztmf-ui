import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { Box, CircularProgress } from '@mui/material'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import type { ScoreAggregate, ScoreProgress, SystemScoreEntry } from '@/types'
import { buildDashboardMaps } from './aggregateScores'
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
  // Which active call(s) each system has scores in, so per-row actions open the
  // system's own data call instead of a globally-selected one.
  const [systemCallMap, setSystemCallMap] = useState<Record<number, number[]>>(
    {}
  )
  const [chosenCallMap, setChosenCallMap] = useState<Record<number, number>>({})

  const { activeDatacallIds } = useContextProp()
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

    // Keep the spinner until the active calls resolve — activeDatacallIds is
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
      <FismaTable
        scores={scoreMap}
        progress={progressMap}
        systemCallMap={systemCallMap}
        chosenCallMap={chosenCallMap}
      />
    </Box>
  )
}
