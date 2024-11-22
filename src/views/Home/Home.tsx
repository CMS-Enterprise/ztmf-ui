import FismaTable from '../FismaTable/FismaTable'
import StatisticsBlocks from '../StatisticBlocks/StatisticsBlocks'
import { useState, useEffect } from 'react'
import axiosInstance from '@/axiosConfig'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
import { FismaSystemType } from '@/types'
/**
 * Component that renders the contents of the Home view.
 * @returns {JSX.Element} Component that renders the home contents.
 */

export default function HomePageContainer() {
  const [loading, setLoading] = useState<boolean>(true)
  const navigate = useNavigate()
  const [fismaSystems, setFismaSystems] = useState<FismaSystemType[]>([])
  const [scoreMap, setScoreMap] = useState<Record<number, number>>({})
  useEffect(() => {
    async function fetchFismaSystems() {
      try {
        const fismaSystems = await axiosInstance.get('/fismasystems')
        if (fismaSystems.status !== 200) {
          setLoading(true)
          return
        }
        setFismaSystems(fismaSystems.data.data)
        setLoading(false)
      } catch (error) {
        console.log(error)
      }
    }
    fetchFismaSystems()
  }, [])

  useEffect(() => {
    async function fetchScores() {
      try {
        const scores = await axiosInstance.get('/scores/aggregate')
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
        console.log(error)
      }
    }
    fetchScores()
  }, [])
  if (loading) {
    {
      navigate(Routes.SIGNIN, {
        replace: true,
        state: {
          message: ERROR_MESSAGES.login,
        },
      })
    }
  }
  return (
    <>
      <div>
        <StatisticsBlocks fismaSystems={fismaSystems} scores={scoreMap} />
        <FismaTable fismaSystems={fismaSystems} scores={scoreMap} />
      </div>
    </>
  )
}
