import { useMemo } from 'react'
import Box from '@mui/material/Box'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { colors } from '@/theme/tokens'
import type { ScoreAggregate } from '@/types'

/** Max axis value, matching the 1-5 user-facing scale. */
const MAX_SCORE = 5

/** Props for {@link TrendRadar}. */
export type TrendRadarProps = {
  /** Current period's pillar scores. */
  latestScore: ScoreAggregate
  /** Previous period's pillar scores, or undefined when no baseline. */
  previousScore?: ScoreAggregate
  /**
   * Whether the parent considers a previous comparison meaningful. When
   * false, the Previous overlay is not rendered. Decoupled from the
   * previousScore prop so the parent (which respects an explicit
   * compare-modal pick) can still hide the overlay even if it has data.
   */
  hasPrevious: boolean
  /** Series label for the current period, e.g. the data-call name. */
  currentLabel?: string
  /** Series label for the previous period, e.g. the data-call name. */
  previousLabel?: string
}

/**
 * Pillar-by-pillar radar chart of the current period vs the previous one.
 * Renders the Previous series as a dashed neutral fill so the Current
 * (solid primary) reads as the dominant signal.
 *
 * Radar data is rebuilt from the parent's chosen previousScore, not a
 * local N-1 lookup, so the chart respects the user's Compare Datacalls
 * modal pick.
 * @param {TrendRadarProps} props - Component props.
 * @returns {JSX.Element} The radar chart.
 */
export default function TrendRadar({
  latestScore,
  previousScore,
  hasPrevious,
  currentLabel,
  previousLabel,
}: TrendRadarProps) {
  // Label the series with the actual data-call names when the parent knows
  // them, so the legend reads "FY24 Q1 vs FY23 Q4" instead of the generic
  // Current/Previous.
  const currentName = currentLabel || 'Current'
  const previousName = previousLabel || 'Previous'
  const radarData = useMemo(() => {
    return (latestScore.pillarscores ?? []).map((p) => ({
      pillar: p.pillar,
      current: p.score ?? 0,
      previous:
        previousScore?.pillarscores?.find((pp) => pp.pillarid === p.pillarid)
          ?.score ?? 0,
    }))
  }, [previousScore, latestScore])

  return (
    <Box
      sx={{ width: '100%', height: 240, mt: 1 }}
      role="img"
      aria-label={
        hasPrevious
          ? 'Radar chart comparing current and previous pillar scores. The same scores appear as text in the pillar grid.'
          : 'Radar chart of current pillar scores. The same scores appear as text in the pillar grid.'
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={colors.neutral200} />
          <PolarAngleAxis
            dataKey="pillar"
            tick={{ fontSize: 11, fill: colors.neutral500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, MAX_SCORE]}
            tick={{ fontSize: 10, fill: colors.neutral400 }}
            tickCount={5}
          />
          <Radar
            name={currentName}
            dataKey="current"
            stroke={colors.primary}
            fill={colors.primary}
            fillOpacity={0.22}
            strokeWidth={2}
          />
          {hasPrevious && (
            <Radar
              name={previousName}
              dataKey="previous"
              stroke={colors.neutral400}
              fill={colors.neutral400}
              fillOpacity={0.14}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              value.toFixed(2),
              name === 'current' ? currentName : previousName,
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  )
}
