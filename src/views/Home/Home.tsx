import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
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
  useEffect(() => {
    async function fetchScores() {
      try {
        const scores = await axiosInstance.get('/scores/aggregate')
        if (scores.status !== 200 && scores.status.toString()[0] === '4') {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.expired,
            },
          })
          return
        }
        const scoresMap: Record<number, number> = {}
        for (const obj of scores.data.data) {
          let score = 0
          if (obj.systemscore) {
            score = obj.systemscore
          }
          scoresMap[obj.fismasystemid] = score
        }
        setScoreMap(scoresMap)
        setLoading(false)
      } catch (error) {
        navigate(Routes.SIGNIN, {
          replace: true,
          state: {
            message: ERROR_MESSAGES.expired,
          },
        })
      }
    }
    fetchScores()
  }, [navigate])

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
