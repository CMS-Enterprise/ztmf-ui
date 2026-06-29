import Box from '@mui/material/Box'
import { colors, fonts, tierDot } from '@/theme/tokens'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'
import type { ScoreTier } from '@/types'

/** Props for {@link ScoreCell}. */
export type ScoreCellProps = {
  /**
   * The score on the user-facing 1-5 scale. Undefined renders as "-" with a
   * neutral tier color (the Not Assessed treatment).
   */
  score: number | undefined
  /**
   * Authoritative tier string. Drives the dot color and the right-most
   * label color via the shared chip palette.
   */
  tier: ScoreTier
}

/**
 * Single inline read-out for a per-question score: tier-colored dot + mono
 * numeric value + tier word. Reads at a glance and degrades to "-" plus a
 * muted color when the row is not assessed, so the table never shows a
 * tier word against an absent value.
 * @param {ScoreCellProps} props - Component props.
 * @returns {JSX.Element} A compact dot + value + tier readout.
 */
export default function ScoreCell({ score, tier }: ScoreCellProps) {
  const notAssessed = tier === 'Not Assessed' || typeof score !== 'number'
  const dotColor = tierDot[tier]
  const tierColor = TIER_CHIP_STYLES[tier].color
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      <Box
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: 13,
          fontWeight: 600,
          color: colors.ink,
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {notAssessed ? '-' : score.toFixed(2)}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 12, fontWeight: 500, color: tierColor }}
      >
        {tier}
      </Box>
    </Box>
  )
}
