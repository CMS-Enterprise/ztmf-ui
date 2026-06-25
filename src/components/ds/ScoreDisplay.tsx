import Box from '@mui/material/Box'
import type { ScoreTier } from '@/types'
import { colors, fonts, tierDot } from '@/theme/tokens'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'

/** Highest possible zero trust score; the bar fills relative to this. */
const MAX_SCORE = 4

/** Props for {@link ScoreDisplay}. */
export type ScoreDisplayProps = {
  /** Numeric score, 0 to 4. When undefined the system has not been assessed. */
  score?: number
  /** Authoritative tier string from the scores API. */
  tier?: ScoreTier
  /** Width of the progress bar in pixels. Defaults to 64. */
  barWidth?: number
  /** Show the tier name to the right of the value. Defaults to true. */
  showTier?: boolean
}

/**
 * Reads a score as a filled bar plus a monospace value plus the tier name.
 *
 * This replaces the old table treatment where a bare numeric score sat in a
 * bordered cell that looked editable. The bar and tier word give a non-color
 * signal alongside the tier color so the meaning survives in greyscale.
 * @param {ScoreDisplayProps} props - Score, tier and layout options.
 * @returns {JSX.Element} The score read-out.
 */
export function ScoreDisplay({
  score,
  tier,
  barWidth = 64,
  showTier = true,
}: ScoreDisplayProps) {
  const hasScore = typeof score === 'number'
  const resolvedTier: ScoreTier = tier ?? 'Not Assessed'
  const fill = hasScore ? Math.max(0, Math.min(1, score / MAX_SCORE)) : 0
  const dotColor = tierDot[resolvedTier]
  const tierText = TIER_CHIP_STYLES[resolvedTier].color

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: barWidth,
          height: 6,
          borderRadius: 1.5,
          backgroundColor: colors.neutral200,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: `${fill * 100}%`,
            height: '100%',
            borderRadius: 1.5,
            backgroundColor: dotColor,
          }}
        />
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: 14,
          fontWeight: 600,
          color: colors.ink,
          minWidth: 34,
        }}
      >
        {hasScore ? score.toFixed(2) : '--'}
      </Box>
      {showTier && (
        <Box
          component="span"
          sx={{ fontSize: 12, fontWeight: 500, color: tierText }}
        >
          {resolvedTier}
        </Box>
      )}
    </Box>
  )
}

export default ScoreDisplay
