import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { colors } from '@/theme/tokens'

/** Props for {@link TrendLine}. */
export type TrendLineProps = {
  /** The current period's overall score. */
  current: number
  /** The prior period's score; undefined when there is no baseline yet. */
  previous?: number
  /** Human-readable previous-period name (e.g. "FY2022"); included in the
   *  trend copy when present. */
  previousDatacallName?: string
}

/**
 * Inline trend readout under the overall score. Renders an up / down /
 * flat arrow + signed delta + "vs <previous>" context. When there is no
 * previous period, falls back to a neutral "First measurement..." line so
 * the slot still earns its space.
 * @param {TrendLineProps} props - Component props.
 * @returns {JSX.Element} The trend line.
 */
export default function TrendLine({
  current,
  previous,
  previousDatacallName,
}: TrendLineProps) {
  if (typeof previous !== 'number') {
    return (
      <Typography
        sx={{ fontSize: 13, fontWeight: 500, color: colors.neutral500 }}
      >
        First measurement, no prior period to compare against.
      </Typography>
    )
  }
  const delta = current - previous
  const flat = Math.abs(delta) < 0.005
  const up = delta > 0
  const color = flat ? colors.neutral500 : up ? colors.up : colors.down
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        color,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {flat ? (
        <TrendingFlatIcon sx={{ fontSize: 14 }} />
      ) : up ? (
        <ArrowUpwardIcon sx={{ fontSize: 14 }} />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 14 }} />
      )}
      <span>
        {flat ? 'No change' : `${up ? '+' : ''}${delta.toFixed(2)}`}
        {previousDatacallName ? ` vs ${previousDatacallName}` : ''}
        {` (was ${previous.toFixed(2)})`}
      </span>
    </Box>
  )
}
