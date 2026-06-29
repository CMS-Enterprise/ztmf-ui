import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, fonts } from '@/theme/tokens'

/** Props for {@link Stat}. */
export type StatProps = {
  /** Small label rendered above the value. */
  label: string
  /** Value text or composed node. */
  value: ReactNode
  /**
   * When true (the default), renders the value in JetBrains Mono. Set to
   * false for non-numeric labels like a datacall name where mono would
   * look out of place.
   */
  mono?: boolean
}

/**
 * Single label + bold-value stat block used inside the overall-score card
 * (Pillars at Optimal, Datacall). Kept neutral so it can host either mono
 * numerics or plain prose values.
 * @param {StatProps} props - Component props.
 * @returns {JSX.Element} A stacked label + value.
 */
export default function Stat({ label, value, mono = true }: StatProps) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 500,
          color: colors.neutral500,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: 16,
          fontWeight: 700,
          color: colors.ink,
          fontFamily: mono ? fonts.mono : 'inherit',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}
