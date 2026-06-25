import { useState, useEffect, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { Typography } from '@mui/material'
import { useContextProp } from '../Title/Context'
import type { SystemScoreEntry } from '@/types'
import { colors, fonts } from '@/theme/tokens'

/**
 * A single dashboard statistic card: an uppercase eyebrow label above a large
 * numeric value, with optional secondary context beneath.
 * @param {object} props - Card content.
 * @param {string} props.label - Uppercase eyebrow label.
 * @param {ReactNode} props.value - The large numeric value.
 * @param {ReactNode} [props.hint] - Optional secondary context line.
 * @param {string} [props.valueColor] - Optional override for the value color.
 * @returns {JSX.Element} A statistic card.
 */
function StatCard({
  label,
  value,
  hint,
  valueColor,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  valueColor?: string
}) {
  return (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 200,
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: 3,
        p: 4,
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colors.neutral500,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 1.5 }}>
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1,
            color: valueColor ?? colors.ink,
          }}
        >
          {value}
        </Typography>
        {hint && (
          <Typography
            sx={{ fontSize: 12, fontWeight: 600, color: colors.neutral500 }}
          >
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

/**
 * Row of dashboard statistic cards summarizing the systems in the active
 * datacall: total count, average score, and the highest and lowest scoring
 * systems. The metrics are computed from the same systems list and score map
 * as before; only the visual treatment changed.
 * @param {object} props - Component props.
 * @param {Record<number, SystemScoreEntry>} props.scores - Score map keyed by
 *   fismasystemid.
 * @returns {JSX.Element} The statistics row.
 */
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
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
      <StatCard label="Total systems" value={totalSystems} />
      <StatCard
        label="Average system score"
        value={avgSystemScore.toFixed(2)}
      />
      <StatCard
        label="Highest system score"
        value={maxSystemScore.toFixed(2)}
        hint={maxSystemAcronym}
        valueColor="#0F5C4C"
      />
      <StatCard
        label="Lowest system score"
        value={
          minSystemScore === Number.POSITIVE_INFINITY
            ? '0.00'
            : minSystemScore.toFixed(2)
        }
        hint={minSystemAcronym}
        valueColor="#A34200"
      />
    </Box>
  )
}
