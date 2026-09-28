import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'
import type { ScoreTier } from '@/types'

/** Props for {@link TierLabel}. */
export type TierLabelProps = { tier?: ScoreTier }

/**
 * Inline tier word rendered to the right of the large overall-score
 * number. Color picks up the tier palette (Optimal green, Advanced amber,
 * etc.). Undefined or "Not Assessed" tiers fall back to a neutral "Not
 * assessed" label so the slot never reads as empty.
 * @param {TierLabelProps} props - Component props.
 * @returns {JSX.Element} The tier word.
 */
export default function TierLabel({ tier }: TierLabelProps) {
  if (!tier || tier === 'Not Assessed') {
    return (
      <Typography
        component="span"
        sx={{ fontSize: 14, fontWeight: 600, color: colors.neutral500 }}
      >
        Not assessed
      </Typography>
    )
  }
  const color = TIER_CHIP_STYLES[tier].color
  return (
    <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color }}>
      {tier}
    </Typography>
  )
}
