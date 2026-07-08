import Box from '@mui/material/Box'
import type { ScoreTier } from '@/types'
import { colors, fonts, radius, tierDot } from '@/theme/tokens'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'

/**
 * Highest possible zero trust score; the bar fills relative to this. The
 * authoritative scale is 1.0-5.0 (backend/internal/model/scores.go applies a
 * +1 shift at aggregation so 0..4 raw option scores become 1.0..5.0).
 */
const MAX_SCORE = 5

/** Em-dash shown for the value when a system has not been assessed. */
const EM_DASH = '—'

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
 * signal alongside the tier color so the meaning survives in greyscale. A
 * not-assessed system renders a dashed empty track, an em-dash value, and
 * muted text so the row visually recedes.
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
  const notAssessed = resolvedTier === 'Not Assessed' || !hasScore
  const fill = hasScore ? Math.max(0, Math.min(1, score / MAX_SCORE)) : 0
  // neutral500 keeps the muted look while clearing the 4.5:1 text-contrast
  // bar (neutral400 measures 2.54:1 on white and fails Section 508).
  const tierText = notAssessed
    ? colors.neutral500
    : TIER_CHIP_STYLES[resolvedTier].color

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: barWidth,
          height: 6,
          borderRadius: `${radius.sm}px`,
          flexShrink: 0,
          ...(notAssessed
            ? {
                border: `1px dashed ${colors.neutral200}`,
                boxSizing: 'border-box',
              }
            : { backgroundColor: colors.neutral200, overflow: 'hidden' }),
        }}
      >
        {!notAssessed && (
          <Box
            sx={{
              width: `${fill * 100}%`,
              height: '100%',
              borderRadius: `${radius.sm}px`,
              backgroundColor: tierDot[resolvedTier],
            }}
          />
        )}
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: 14,
          fontWeight: 600,
          color: notAssessed ? colors.neutral500 : colors.ink,
          minWidth: 34,
        }}
      >
        {notAssessed ? EM_DASH : score.toFixed(2)}
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
