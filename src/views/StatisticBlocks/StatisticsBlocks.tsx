import { useMemo, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { Typography } from '@mui/material'
import { useContextProp } from '../Title/Context'
import type { SystemScoreEntry } from '@/types'
import { colors, fonts, radius } from '@/theme/tokens'

const ARROW_UP = '↑'
const ARROW_DOWN = '↓'

/**
 * A single dashboard statistic card: an uppercase eyebrow label above a large
 * numeric value, with an optional colored sub-label beside it.
 * @param {object} props - Card content.
 * @param {string} props.label - Uppercase eyebrow label.
 * @param {ReactNode} props.value - The large numeric value.
 * @param {ReactNode} [props.hint] - Optional secondary context line.
 * @param {string} [props.valueColor] - Optional override for the value color.
 * @param {string} [props.hintColor] - Optional override for the hint color.
 * @returns {JSX.Element} A statistic card.
 */
function StatCard({
  label,
  value,
  hint,
  valueColor,
  hintColor,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  valueColor?: string
  hintColor?: string
}) {
  return (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 180,
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
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
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
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
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: hintColor ?? colors.neutral500,
            }}
          >
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

/** Props for {@link StatisticsBlocks}. */
export type StatisticsBlocksProps = {
  /** Score map for the active datacall, keyed by fismasystemid. */
  scores: Record<number, SystemScoreEntry>
  /** Average system score for the prior datacall, when one exists. */
  priorAvg?: number
  /** Short label for the prior datacall, e.g. "FY22". */
  priorLabel?: string
}

/**
 * Row of dashboard statistic cards: total systems, average zero-trust score
 * (with a trend vs the prior datacall when available), how many systems are at
 * Optimal or Advanced, and how many fall below the Initial tier. Every value is
 * derived from real data (the systems list and the backend score tiers).
 * @param {StatisticsBlocksProps} props - Score map and optional prior average.
 * @returns {JSX.Element} The statistics row.
 */
export default function StatisticsBlocks({
  scores,
  priorAvg,
  priorLabel,
}: StatisticsBlocksProps) {
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

  // Average-score trend vs the prior datacall, when one is available.
  const delta =
    priorAvg !== undefined && priorLabel ? stats.avg - priorAvg : undefined
  const avgHint =
    delta !== undefined && Math.abs(delta) >= 0.005
      ? `${delta > 0 ? ARROW_UP : ARROW_DOWN} ${Math.abs(delta).toFixed(
          2
        )} vs ${priorLabel}`
      : undefined
  const avgHintColor =
    delta !== undefined && delta < 0 ? colors.down : colors.up

  const belowZero = stats.belowInitial === 0

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
      <StatCard label="Total systems" value={stats.total} />
      <StatCard
        label="Avg ZT score"
        value={stats.avg.toFixed(2)}
        hint={avgHint}
        hintColor={avgHintColor}
      />
      <StatCard
        label="Optimal / Advanced"
        value={stats.optimalAdvanced}
        hint={`of ${stats.total} systems`}
        valueColor={colors.up}
      />
      <StatCard
        label="Below initial"
        value={stats.belowInitial}
        hint={belowZero ? 'nothing to worry about' : 'need attention'}
        valueColor={belowZero ? colors.neutral500 : colors.down}
      />
    </Box>
  )
}
