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
  /**
   * Stack the tier name above the bar + value row instead of beside it.
   * Halves the horizontal footprint for tight table columns.
   */
  stacked?: boolean
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
  stacked = false,
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

  const tierLabel = showTier && (
    <Box
      component="span"
      sx={{ fontSize: 12, fontWeight: 500, color: tierText }}
    >
      {resolvedTier}
    </Box>
  )

  if (stacked) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0.25,
        }}
      >
        {tierLabel}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScoreBar
            barWidth={barWidth}
            notAssessed={notAssessed}
            fill={fill}
            tier={resolvedTier}
          />
          <ScoreValue notAssessed={notAssessed} score={score} />
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <ScoreBar
        barWidth={barWidth}
        notAssessed={notAssessed}
        fill={fill}
        tier={resolvedTier}
      />
      <ScoreValue notAssessed={notAssessed} score={score} />
      {tierLabel}
    </Box>
  )
}

/**
 * The filled (or dashed not-assessed) score track.
 * @param {object} props - Bar width, fill fraction, tier and assessed state.
 * @returns {JSX.Element} The bar.
 */
function ScoreBar({
  barWidth,
  notAssessed,
  fill,
  tier,
}: {
  barWidth: number
  notAssessed: boolean
  fill: number
  tier: ScoreTier
}) {
  return (
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
            backgroundColor: tierDot[tier],
          }}
        />
      )}
    </Box>
  )
}

/**
 * The monospace numeric value, or an em-dash when not assessed.
 * @param {object} props - Score and assessed state.
 * @returns {JSX.Element} The value span.
 */
function ScoreValue({
  notAssessed,
  score,
}: {
  notAssessed: boolean
  score?: number
}) {
  return (
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
      {notAssessed || typeof score !== 'number' ? EM_DASH : score.toFixed(2)}
    </Box>
  )
}

export default ScoreDisplay
