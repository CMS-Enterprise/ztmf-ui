import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useContextProp } from '../Title/Context'
import type { SystemScoreEntry } from '@/types'
const StatisticsPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  ...theme.typography.body2,
  // Center the numeral + label and let the card grow with its content so long
  // system names wrap instead of clipping past a fixed height. The wrapper's
  // stretch + minHeight keeps every card the same size.
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  overflowWrap: 'break-word',
}))
export default function StatisticsBlocks({
  scores,
}: {
  scores: Record<number, SystemScoreEntry>
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
      const entry = scores[system.fismasystemid]
      if (entry && entry.score) {
        if (entry.score > maxScore) {
          maxScore = entry.score
          maxScoreSystem = system.fismaacronym
        }
        if (entry.score < minScore) {
          minScore = entry.score
          minScoreSystem = system.fismaacronym
        }
        totalScores += entry.score
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
        alignItems: 'stretch',
        '& > :not(style)': {
          m: 1,
          width: 270,
          minHeight: 128,
          borderWidth: 2,
        },
      }}
    >
      <StatisticsPaper variant="outlined">
        <Typography variant="h2" sx={{ color: '#004297', fontSize: '56px' }}>
          {totalSystems}
        </Typography>
        <Typography
          variant="body1"
          sx={{ fontSize: '16px', overflowWrap: 'break-word' }}
        >
          Total Systems
        </Typography>
      </StatisticsPaper>
      <StatisticsPaper variant="outlined">
        <Typography variant="h2" sx={{ color: '#004297', fontSize: '56px' }}>
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
          variant="h2"
          sx={{
            color: '#128172',
            fontSize: '50px',
          }}
        >
          {maxSystemScore.toFixed(2)}
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
          variant="h2"
          sx={{
            color: '#960B91',
            fontSize: '50px',
          }}
        >
          {minSystemScore === Number.POSITIVE_INFINITY
            ? '0.00'
            : minSystemScore.toFixed(2)}
        </Typography>
        <Typography variant="body1" sx={{ fontSize: '16px' }}>
          Lowest System Score: <br /> {minSystemAcronym}
        </Typography>
      </StatisticsPaper>
    </Box>
  )
}
