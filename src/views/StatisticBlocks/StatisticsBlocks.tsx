import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useContextProp } from '../Title/Context'
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
  scores,
}: {
  scores: Record<number, number>
}) {
  const { fismaSystems } = useContextProp()
  const [totalSystems, setTotalSystems] = useState<number>(0)
  const [avgSystemScore, setAvgSystemScore] = useState<number>(0)
  const [maxSystemAcronym, setMaxSystemAcronym] = useState<string>('')
  const [maxSystemScore, setMaxSystemScore] = useState<number>(0)
  const [minSystemScore, setMinSystemScore] = useState<number>(0)
  const [minSystemAcronym, setMinSystemAcronym] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    const totalCount = fismaSystems.length
    let maxScore: number = 0
    let maxScoreSystem: string = ''
    let minScore: number = Number.POSITIVE_INFINITY
    let minScoreSystem: string = ''
    let totalScores: number = 0
    for (const system of fismaSystems) {
      if (scores[system.fismasystemid]) {
        if (scores[system.fismasystemid] > maxScore) {
          maxScore = scores[system.fismasystemid]
          maxScoreSystem = system.fismaacronym
        } else if (scores[system.fismasystemid] < minScore) {
          minScore = scores[system.fismasystemid]
          minScoreSystem = system.fismaacronym
        }
        if (scores[system.fismasystemid]) {
          totalScores += scores[system.fismasystemid]
        }
      }
    }
    if (totalCount === 0) {
      setAvgSystemScore(0)
      setMinSystemScore(0)
    } else {
      setAvgSystemScore(Number((totalScores / totalCount).toFixed(2)))
      setMinSystemScore(minScore)
    }
    setTotalSystems(totalCount)
    setMaxSystemScore(maxScore)
    setMaxSystemAcronym(maxScoreSystem || '')

    setMinSystemAcronym(minScoreSystem || '')
    setLoading(false)
  }, [fismaSystems, scores])
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
        <Typography
          variant="h4"
          sx={{
            color: '#128172',
            fontSize: '50px',
          }}
        >
          {maxSystemScore}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontSize: '16px',
          }}
        >
          Highest System Score:
          <br /> {maxSystemAcronym}
        </Typography>
      </StatisticsPaper>
      <StatisticsPaper variant="outlined">
        <Typography
          variant="h4"
          sx={{
            color: '#960B91',
            fontSize: '50px',
            // overflowWrap: 'break-word',
          }}
        >
          {minSystemScore === Number.POSITIVE_INFINITY ? 0 : minSystemScore}
        </Typography>
        <Typography variant="body1" sx={{ fontSize: '16px' }}>
          Lowest System Score: <br /> {minSystemAcronym}
        </Typography>
      </StatisticsPaper>
    </Box>
  )
}
