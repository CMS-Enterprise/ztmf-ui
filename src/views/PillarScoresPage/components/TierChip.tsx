import Box from '@mui/material/Box'
import { radius } from '@/theme/tokens'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'
import type { ScoreTier } from '@/types'

/** Props for {@link TierChip}. */
export type TierChipProps = { tier: ScoreTier }

/**
 * Compact pill rendering the tier name with the matching pastel
 * background. Used in the top-right of each pillar tile in the pillar
 * grid - effectively a small tag, not a status button.
 * @param {TierChipProps} props - Component props.
 * @returns {JSX.Element} The tier chip.
 */
export default function TierChip({ tier }: TierChipProps) {
  const palette = TIER_CHIP_STYLES[tier]
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        px: 1,
        py: 0.25,
        borderRadius: `${radius.pill}px`,
        color: palette.color,
        backgroundColor: palette.backgroundColor,
      }}
    >
      {tier}
    </Box>
  )
}
