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
/**
 * Component that renders the contents of the Home view.
 * @returns {JSX.Element} Component that renders the home contents.
 */

export default function HomePageContainer() {
  const [loading, setLoading] = useState<boolean>(true)
  const navigate = useNavigate()
  const [scoreMap, setScoreMap] = useState<Record<number, number>>({})
  const { latestDataCallId } = useContextProp()
  useEffect(() => {
    async function fetchScores() {
      if (latestDataCallId !== 0) {
        await axiosInstance
          .get(`/scores/aggregate?datacallid=${latestDataCallId}`)
          .then((res) => {
            const scoresMap: Record<number, number> = {}
            for (const obj of res.data.data) {
              let score = 0
              if (obj.systemscore) {
                score = obj.systemscore
              }
              scoresMap[obj.fismasystemid] = score
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
  }, [navigate, latestDataCallId])

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
      <FismaTable scores={scoreMap} latestDataCallId={latestDataCallId} />
    </Box>
  )
}
