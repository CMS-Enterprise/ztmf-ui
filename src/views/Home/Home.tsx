import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { Box, CircularProgress } from '@mui/material'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import type { ScoreAggregate, ScoreProgress, SystemScoreEntry } from '@/types'
import {
  buildScoreMap,
  buildProgressMap,
  buildSystemCallMap,
} from './aggregateScores'
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
  const { activeDatacallIds } = useContextProp()
  useEffect(() => {
    const controller = new AbortController()
    const ids = activeDatacallIds

    // Scores are aggregated across every active call in the year: each call is
    // fetched independently (per-request .catch so one failure doesn't sink the
    // batch) and the rows are merged by fismasystemid. A CMS system shows its
    // FY.. Q# score and an HHS system its FY.. ZTM score, so no tenant reads 0.
    async function fetchScores() {
      const rowsPerCall = await Promise.all(
        ids.map((id) =>
          axiosInstance
            .get(`/scores/aggregate?datacallid=${id}`, {
              signal: controller.signal,
            })
            .then((res) => res.data.data as ScoreAggregate[])
            .catch((error) => {
              // Log so a single call's failure (which shows its systems as 0)
              // is diagnosable rather than silent.
              if (!controller.signal.aborted)
                console.error(`scores/aggregate ${id} failed:`, error)
              return [] as ScoreAggregate[]
            })
        )
      )
      if (controller.signal.aborted) return
      setScoreMap(buildScoreMap(rowsPerCall))
      setSystemCallMap(buildSystemCallMap(rowsPerCall))
      setLoading(false)
    }

    // Progress (ztmf#299) aggregated the same way, but independent of scores: a
    // failure here leaves the progress column as em-dashes without blocking the
    // score display, so it doesn't gate `loading`.
    async function fetchProgress() {
      const rowsPerCall = await Promise.all(
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
      )
      if (controller.signal.aborted) return
      setProgressMap(buildProgressMap(rowsPerCall))
    }

    // Keep the spinner until the active calls resolve — activeDatacallIds is
    // empty on the first paint while Title is still fetching /datacalls, so
    // don't clear loading (which would flash an empty dashboard) until there
    // are calls to fetch.
    if (ids.length > 0) {
      fetchScores()
      fetchProgress()
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
      />
    </Box>
  )
}
