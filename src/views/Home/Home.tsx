import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect, useRef } from 'react'
import axiosInstance from '@/axiosConfig'
import { FismaSystemType, ScoreData } from '@/types'
import CircularProgress from '@mui/material/CircularProgress'
import { Box } from '@mui/material'
/**
 * Component that renders the contents of the Home view.
 * @returns {JSX.Element} Component that renders the home contents.
 */

export default function HomePageContainer() {
  const [loading, setLoading] = useState<boolean>(true)
  const [fismaSystems, setFismaSystems] = useState<FismaSystemType[]>([])
  const hasRedirected = useRef(false)
  const [scores, setScores] = useState<ScoreData[]>([])

  useEffect(() => {
    const fetchFismaSystems = async () => {
      try {
        const fismaSystems = await axiosInstance.get('/fismasystems')
        if (fismaSystems.status !== 200 && !hasRedirected.current) {
          hasRedirected.current = true
          window.location.href = '/login'
        }
        setFismaSystems(fismaSystems.data.data)
      } catch (error) {
        console.log(error)
      } finally {
        setLoading(false)
      }
    }
    fetchFismaSystems()
  }, [])
  useEffect(() => {
    const fetchScores = async () => {
      try {
        const scores = await axiosInstance.get('/scores/aggregate')
        if (scores.status !== 200 && !hasRedirected.current) {
          hasRedirected.current = true
          window.location.href = '/login'
        }
        setScores(scores.data.data)
      } catch (error) {
        console.log(error)
      } finally {
        setLoading(false)
      }
    }
    fetchScores()
  }, [fismaSystems])
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }
  return (
    <>
      <div>
        <StatisticsBlocks fismaSystems={fismaSystems} scores={scores} />
        <FismaTable fismaSystems={fismaSystems} />
      </div>
    </>
  )
}
