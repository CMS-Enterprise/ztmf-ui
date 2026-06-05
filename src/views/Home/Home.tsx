import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
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
  const navigate = useNavigate()
  const [scoreMap, setScoreMap] = useState<Record<number, SystemScoreEntry>>({})
  const { latestDataCallId, selectedDataCallId } = useContextProp()
  const activeDataCallId = selectedDataCallId || latestDataCallId
  useEffect(() => {
    async function fetchScores() {
      if (activeDataCallId !== 0) {
        await axiosInstance
          .get(`/scores/aggregate?datacallid=${activeDataCallId}`)
          .then((res) => {
            const scoresMap: Record<number, SystemScoreEntry> = {}
            for (const obj of res.data.data as ScoreAggregate[]) {
              scoresMap[obj.fismasystemid] = {
                score: obj.systemscore ?? 0,
                tier: obj.systemtier,
              }
            }
            setScoreMap(scoresMap)
            setLoading(false)
          })
          .catch((error) => {
            if (error.response.status == 401) {
              if (error.response.status == 401) {
                navigate(Routes.SIGNIN, {
                  replace: true,
                  state: {
                    message: ERROR_MESSAGES.expired,
                  },
                })
              }
            }
          })
      }
    }
    fetchScores()
  }, [navigate, activeDataCallId])

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
