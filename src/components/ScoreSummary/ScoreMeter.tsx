/**
 * Position of a score on the 1.0-5.0 maturity scale.
 *
 * A meter rather than a radial dial: the question is "where does this sit
 * against the tier bands", and a linear track can show the band boundaries
 * themselves, which a dial cannot. The bands are labeled in text, so the
 * reading never depends on telling two fills apart.
 *
 * @module components/ScoreSummary/ScoreMeter
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, fonts, radius, tierDot } from '@/theme/tokens'
import type { ScoreTier } from '@/types'

/** Scale bounds, matching the backend's user-facing score range. */
const MIN_SCORE = 1
const MAX_SCORE = 5

/**
 * Tier bands on the 1.0-5.0 scale, mirroring the backend's Tier() cutoffs.
 * Rendered as the meter's track so the score's band is visible by position.
 */
const BANDS: { tier: ScoreTier; from: number; to: number }[] = [
  { tier: 'Traditional', from: 1.0, to: 2.1 },
  { tier: 'Initial', from: 2.1, to: 3.1 },
  { tier: 'Advanced', from: 3.1, to: 4.1 },
  { tier: 'Optimal', from: 4.1, to: 5.0 },
]

/** Props for {@link ScoreMeter}. */
export type ScoreMeterProps = {
  /** The score to mark, or null when nothing is scored. */
  score: number | null
}

/**
 * Converts a score to its percentage position along the track.
 * @param {number} score - A score on the 1.0-5.0 scale.
 * @returns {number} Position as a percentage.
 */
function positionPct(score: number): number {
  const clamped = Math.min(MAX_SCORE, Math.max(MIN_SCORE, score))
  return ((clamped - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * 100
}

/**
 * Renders the tier-band track with a marker at the score.
 * @param {ScoreMeterProps} props - The score.
 * @returns {JSX.Element} The meter.
 */
export default function ScoreMeter({ score }: ScoreMeterProps) {
  return (
    <Box sx={{ mt: 1 }}>
      <Box
        aria-hidden="true"
        sx={{
          position: 'relative',
          display: 'flex',
          // 2px surface gaps between bands, so neighbouring fills never touch.
          gap: '2px',
          height: 8,
        }}
      >
        {BANDS.map((band) => (
          <Box
            key={band.tier}
            sx={{
              flexGrow: band.to - band.from,
              // A wash, not a saturated block: the marker is the loud thing.
              backgroundColor: tierDot[band.tier],
              opacity: 0.22,
              borderRadius: `${radius.sm}px`,
            }}
          />
        ))}
        {score !== null && (
          <Box
            sx={{
              position: 'absolute',
              left: `${positionPct(score)}%`,
              top: -3,
              transform: 'translateX(-50%)',
              width: 3,
              height: 14,
              borderRadius: 2,
              backgroundColor: colors.ink,
              // Surface ring, so the marker stays legible over any band.
              boxShadow: `0 0 0 2px ${colors.white}`,
            }}
          />
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 0.5,
        }}
      >
        {[MIN_SCORE, MAX_SCORE].map((bound) => (
          <Typography
            key={bound}
            sx={{
              fontFamily: fonts.mono,
              fontSize: 10,
              fontVariantNumeric: 'tabular-nums',
              color: colors.neutral500,
            }}
          >
            {bound.toFixed(2)}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}
