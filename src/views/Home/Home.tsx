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
  const [latestDataCallId, setLatestDataCallId] = useState<number>(0)
  useEffect(() => {
    async function fetchFismaSystems() {
      try {
        const fismaSystems = await axiosInstance.get('/fismasystems')
        if (
          fismaSystems.status !== 200 &&
          fismaSystems.status.toString()[0] === '4'
        ) {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.expired,
            },
          })
          return
        }
        setFismaSystems(fismaSystems.data.data)
        setLoading(false)
      } catch (error) {
        console.log(error)
        navigate(Routes.SIGNIN, {
          replace: true,
          state: {
            message: ERROR_MESSAGES.login,
          },
        })
      }
    }
    fetchFismaSystems()
  }, [navigate])

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
  useEffect(() => {
    async function fetchLatestDatacall() {
      try {
        axiosInstance.get('/datacalls').then((res) => {
          if (res.status !== 200 && res.status.toString()[0] === '4') {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.expired,
              },
            })
          }
          setLatestDataCallId(res.data.data[0].datacallid)
        })
      } catch (error) {
        console.error(error)
        navigate(Routes.SIGNIN, {
          replace: true,
          state: {
            message: ERROR_MESSAGES.error,
          },
        })
      }
    }
    fetchLatestDatacall()
  }, [navigate])
  if (loading) {
    return <div>Loading...</div>
  }
  return (
    <>
      <div>
        <StatisticsBlocks scores={scoreMap} />
        <FismaTable scores={scoreMap} latestDataCallId={latestDataCallId} />
      </div>
    </>
  )
}
