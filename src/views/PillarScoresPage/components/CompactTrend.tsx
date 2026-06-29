import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { colors } from '@/theme/tokens'

/** Props for {@link CompactTrend}. */
export type CompactTrendProps = {
  /** Current period's value. */
  current: number
  /** Prior period's value; undefined when there's no baseline. */
  previous?: number
}

/**
 * Smaller sibling of {@link TrendLine}, used inline next to a pillar's
 * score in the pillar grid. Same arrow + signed-delta shape minus the
 * "vs <previous>" context, since the grid already groups the relevant
 * pillar implicitly. Falls back to a muted "first run" tag when no
 * previous value is available.
 * @param {CompactTrendProps} props - Component props.
 * @returns {JSX.Element} The compact trend indicator.
 */
export default function CompactTrend({ current, previous }: CompactTrendProps) {
  if (typeof previous !== 'number') {
    return (
      <Typography
        component="span"
        sx={{ fontSize: 12, color: colors.neutral500 }}
      >
        first run
      </Typography>
    )
  }
  const delta = current - previous
  const flat = Math.abs(delta) < 0.005
  const up = delta > 0
  const color = flat ? colors.neutral500 : up ? colors.up : colors.down
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        color,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {flat ? (
        <TrendingFlatIcon sx={{ fontSize: 12 }} />
      ) : up ? (
        <ArrowUpwardIcon sx={{ fontSize: 12 }} />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 12 }} />
      )}
      <span>{flat ? 'no change' : `${up ? '+' : ''}${delta.toFixed(2)}`}</span>
    </Box>
  )
}
