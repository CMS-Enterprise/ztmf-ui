import { useMemo, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { Typography } from '@mui/material'
import { useContextProp } from '../Title/Context'
import type { SystemScoreEntry } from '@/types'
import { colors, fonts } from '@/theme/tokens'

/**
 * A single dashboard statistic card: an uppercase eyebrow label above a large
 * numeric value, with optional secondary context beside it.
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
        minWidth: 180,
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
 * Row of dashboard statistic cards: total systems, average zero-trust score,
 * how many systems are at Optimal or Advanced, and how many fall below the
 * Initial tier. Every value is derived from the systems list and the score map
 * (tiers come from the backend); nothing is fabricated.
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

  const stats = useMemo(() => {
    const total = fismaSystems.length
    let scored = 0
    let scoreSum = 0
    let optimalAdvanced = 0
    let belowInitial = 0
    for (const system of fismaSystems) {
      const entry = scores[system.fismasystemid]
      if (!entry) continue
      if (entry.score) {
        scoreSum += entry.score
        scored += 1
      }
      if (entry.tier === 'Optimal' || entry.tier === 'Advanced') {
        optimalAdvanced += 1
      }
      if (entry.tier === 'Traditional') {
        belowInitial += 1
      }
    }
    const avg = scored > 0 ? scoreSum / scored : 0
    return { total, avg, optimalAdvanced, belowInitial }
  }, [fismaSystems, scores])

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
      <StatCard label="Total systems" value={stats.total} />
      <StatCard label="Avg ZT score" value={stats.avg.toFixed(2)} />
      <StatCard
        label="Optimal / Advanced"
        value={stats.optimalAdvanced}
        hint={`of ${stats.total} systems`}
        valueColor="#0F5C4C"
      />
      <StatCard
        label="Below initial"
        value={stats.belowInitial}
        hint="need attention"
        valueColor="#A34200"
      />
    </Box>
  )
}
