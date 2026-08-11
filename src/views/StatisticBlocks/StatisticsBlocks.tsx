import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useContextProp } from '../Title/Context'
import type { ScoreProgress, ScoreTier, SystemScoreEntry } from '@/types'
import { TIERS } from '@/utils/tierStyles'
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
  progress,
}: {
  scores: Record<number, SystemScoreEntry>
  progress?: Record<number, ScoreProgress>
}) {
  const { fismaSystems } = useContextProp()
  const [totalSystems, setTotalSystems] = useState<number>(0)
  const [answeredSystems, setAnsweredSystems] = useState<number>(0)
  const [avgSystemScore, setAvgSystemScore] = useState<number>(0)
  const [maxSystemAcronym, setMaxSystemAcronym] = useState<string>('')
  const [maxSystemScore, setMaxSystemScore] = useState<number>(0)
  const [maxSystemTier, setMaxSystemTier] = useState<ScoreTier | undefined>(
    undefined
  )
  const [minSystemScore, setMinSystemScore] = useState<number>(0)
  const [minSystemTier, setMinSystemTier] = useState<ScoreTier | undefined>(
    undefined
  )
  const [minSystemAcronym, setMinSystemAcronym] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    // The average divides by the scored systems only: the scores map is scoped
    // to the selected call(s), so unscored systems must not dilute it. The
    // Scored / Systems tile pairs that scored count with a denominator scoped
    // the same way - the systems actually in the selected call(s), taken from
    // the progress map - instead of a call-scoped numerator over an all-systems
    // denominator, which read as an order-of-magnitude larger backlog than real.
    let scoredCount: number = 0
    let inCallCount: number = 0
    let maxScore: number = 0
    let maxScoreSystem: string = ''
    let maxScoreTier: ScoreTier | undefined
    let minScore: number = Number.POSITIVE_INFINITY
    let minScoreSystem: string = ''
    let minScoreTier: ScoreTier | undefined
    let totalScores: number = 0
    for (const system of fismaSystems) {
      const entry = scores[system.fismasystemid]
      // A system is in the selected call(s) if the progress map carries a row
      // for it with questions to answer (questionsexpected > 0), a set that
      // includes never-started systems. A scored system always has such a row
      // when the progress fetch succeeds, so the ratio stays within 100% without
      // a special case; if the whole progress fetch fails the denominator reads
      // 0, which surfaces the outage instead of hiding it behind a false "all
      // scored" (which counting scored systems here would produce).
      const progressEntry = progress?.[system.fismasystemid]
      if ((progressEntry?.questionsexpected ?? 0) > 0) {
        inCallCount += 1
      }
      // Truthy check, not a null check, on purpose. Backend system scores are
      // floored at 1.0 (each pillar averages the answer score plus one), so a
      // real score is never 0. A 0 here only comes from an absent/null score
      // being coalesced to 0 upstream, which must not count as scored. If
      // scoring ever moves to a 0-based scale, this has to distinguish the two.
      if (entry && entry.score) {
        if (entry.score > maxScore) {
          maxScore = entry.score
          maxScoreSystem = system.fismaacronym
          maxScoreTier = entry.tier
        }
        if (entry.score < minScore) {
          minScore = entry.score
          minScoreSystem = system.fismaacronym
          minScoreTier = entry.tier
        }
        totalScores += entry.score
        scoredCount += 1
      }
    }
    if (scoredCount === 0) {
      setAvgSystemScore(0)
      setMinSystemScore(0)
    } else {
      setAvgSystemScore(Number((totalScores / scoredCount).toFixed(2)))
      setMinSystemScore(minScore)
    }
    setAnsweredSystems(scoredCount)
    setTotalSystems(inCallCount)
    setMaxSystemScore(maxScore)
    setMaxSystemTier(maxScoreTier)
    setMaxSystemAcronym(maxScoreSystem || '')

    setMinSystemTier(minScoreTier)
    setMinSystemAcronym(minScoreSystem || '')
    setLoading(false)
  }, [fismaSystems, scores, progress])
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
        <Typography variant="h2" sx={{ color: '#004297', fontSize: '44px' }}>
          {answeredSystems.toLocaleString()} / {totalSystems.toLocaleString()}
        </Typography>
        <Typography
          variant="body1"
          sx={{ fontSize: '16px', overflowWrap: 'break-word' }}
        >
          Scored / Systems in selected data calls
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
            color: maxSystemTier ? TIERS[maxSystemTier].chip.color : 'inherit',
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
            color: minSystemTier ? TIERS[minSystemTier].chip.color : 'inherit',
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
