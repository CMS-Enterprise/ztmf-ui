import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { FismaSystemType, ScoreData } from '@/types'
const StatisticsPaper = styled(Paper)(({ theme }) => ({
  width: 120,
  height: 120,
  padding: theme.spacing(2),
  ...theme.typography.body2,
  textAlign: 'center',
  overflowWrap: 'break-word',
  elevation: 3,
}))
export default function StatisticsBlocks({
  fismaSystems,
  scores,
}: {
  fismaSystems: FismaSystemType[]
  scores: ScoreData[]
}) {
  const [totalSystems, setTotalSystems] = useState<number>(0)
  const [avgSystemScore, setAvgSystemScore] = useState<number>(0)
  const [maxSystemAcronym, setMaxSystemAcronym] = useState<string>('')
  const [maxSystemScore, setMaxSystemScore] = useState<number>(0)
  const [minSystemScore, setMinSystemScore] = useState<number>(0)
  const [minSystemAcronym, setMinSystemAcronym] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  useEffect(() => {
    if (scores.length > 0) {
      const scoresMap = scores.reduce(
        (acc, score) => {
          acc[score.fismasystemid] = score.systemscore
          return acc
        },
        {} as Record<number, number>
      )
      let maxScore: number = 0
      let maxScoreSystem: string = ''
      let minScore: number = Number.POSITIVE_INFINITY
      let minScoreSystem: string = ''
      let totalScores: number = 0
      for (const system of fismaSystems) {
        if (scoresMap[system.fismasystemid] > maxScore) {
          maxScore = scoresMap[system.fismasystemid]
          maxScoreSystem = system.fismaacronym
        } else if (scoresMap[system.fismasystemid] < minScore) {
          minScore = scoresMap[system.fismasystemid]
          minScoreSystem = system.fismaacronym
        }
        if (scoresMap[system.fismasystemid]) {
          totalScores += scoresMap[system.fismasystemid]
        }
      }
      setTotalSystems(fismaSystems.length)
      setAvgSystemScore(Number((totalScores / fismaSystems.length).toFixed(2)))
      setMaxSystemScore(maxScore)
      setMaxSystemAcronym(maxScoreSystem || '')
      setMinSystemScore(minScore)
      setMinSystemAcronym(minScoreSystem || '')
    }
    setLoading(false)
  }, [scores, fismaSystems])
  if (loading) {
    return <p>Loading ...</p>
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-evenly',
        '& > :not(style)': {
          m: 1,
          width: 270,
          height: 128,
          borderWidth: 2,
        },
      }}
    >
      <StatisticsPaper variant="outlined">
        <Typography variant="h4" sx={{ color: '#004297', fontSize: '56px' }}>
          {totalSystems}
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontSize: '16px', overflowWrap: 'break-word' }}
        >
          Total Systems
        </Typography>
      </StatisticsPaper>
      <StatisticsPaper variant="outlined">
        <Typography variant="h4" sx={{ color: '#004297', fontSize: '56px' }}>
          {avgSystemScore}
        </Typography>
        <Typography
          variant="body1"
          sx={{ fontSize: '16px', overflowWrap: 'break-word' }}
        >
          Average System Score
        </Typography>
      </StatisticsPaper>
      <StatisticsPaper variant="outlined">
        <Typography variant="h4" sx={{ color: '#128172', fontSize: '56px' }}>
          {maxSystemScore}
        </Typography>
        <Typography
          variant="body1"
          sx={{ fontSize: '16px', overflowWrap: 'break-word' }}
        >
          Highest System Score: {maxSystemAcronym}
        </Typography>
      </StatisticsPaper>
      <StatisticsPaper variant="outlined">
        <Typography variant="h4" sx={{ color: '#960B91', fontSize: '56px' }}>
          {minSystemScore}
        </Typography>
        <Typography variant="body1" sx={{ fontSize: '16px' }}>
          Lowest System Score: {minSystemAcronym}
        </Typography>
      </StatisticsPaper>
    </Box>
  )
}
