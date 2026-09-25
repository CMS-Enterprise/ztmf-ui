import Box from '@mui/material/Box'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { colors } from '@/theme/tokens'

/** Props for {@link TrendingPill}. */
export type TrendingPillProps = { direction: 'up' | 'down' | 'flat' }

/**
 * Mini "trending up / down" indicator shown next to the OVERALL ZT SCORE
 * eyebrow. Hidden for the flat case so the eyebrow stays clean when there
 * is no movement worth flagging.
 * @param {TrendingPillProps} props - Component props.
 * @returns {JSX.Element | null} The trending pill, or null when flat.
 */
export default function TrendingPill({ direction }: TrendingPillProps) {
  if (direction === 'flat') return null
  const up = direction === 'up'
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        fontSize: 11,
        fontWeight: 600,
        color: up ? colors.up : colors.down,
      }}
    >
      {up ? (
        <ArrowUpwardIcon sx={{ fontSize: 12 }} />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 12 }} />
      )}
      {up ? 'trending up' : 'trending down'}
    </Box>
  )
}
