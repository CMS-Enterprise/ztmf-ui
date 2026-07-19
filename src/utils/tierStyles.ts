import type { ScoreTier } from '@/types'

// Two style sub-keys per tier: chip (soft pastels + dark text for modal
// chips; AAA contrast at chip text size) and cell (high-contrast pastels
// that pass 508/WCAG color-distinguishability on table score cells;
// black-on-pastel is >10:1 for every entry).
// Not Assessed cell is transparent so a score-0 table row reads as
// "no signal" rather than a false tier color.
export const TIERS: Record<
  ScoreTier,
  {
    chip: { color: string; backgroundColor: string }
    cell: { backgroundColor: string }
  }
> = {
  Optimal: {
    chip: { color: '#0F5C4C', backgroundColor: '#E8F8F6' },
    cell: { backgroundColor: '#93F0ED' },
  },
  Advanced: {
    chip: { color: '#6B6200', backgroundColor: '#FEFEF0' },
    cell: { backgroundColor: '#F2FBC4' },
  },
  Initial: {
    chip: { color: '#A34200', backgroundColor: '#FFF4E6' },
    cell: { backgroundColor: '#FFD5A5' },
  },
  Traditional: {
    chip: { color: '#663399', backgroundColor: '#F3F0FF' },
    cell: { backgroundColor: '#DAA9EC' },
  },
  'Not Assessed': {
    chip: { color: '#525252', backgroundColor: '#F8F8F8' },
    cell: { backgroundColor: 'transparent' },
  },
}

export const tierStyle = (tier: ScoreTier | undefined) =>
  tier ? TIERS[tier] : undefined

// Chip-only view of TIERS for the redesign components (ScoreDisplay,
// TierChip, TierLabel, ScoreCell) that address the palette as a flat map.
export const TIER_CHIP_STYLES: Record<
  ScoreTier,
  { color: string; backgroundColor: string }
> = Object.fromEntries(
  Object.entries(TIERS).map(([tier, styles]) => [tier, styles.chip])
) as Record<ScoreTier, { color: string; backgroundColor: string }>

/**
 * Mirrors backend/internal/model/scores.go:Tier exactly for the rare case
 * where the FE has a raw 1.0-5.0 score but no tier string from the API
 * (per-question rows derived from option scores, manual aggregation, tests).
 *
 * Whenever the score comes back from /scores or /scores/aggregate, prefer
 * the API's `tier` / `systemtier` field over re-deriving here.
 *
 * Boundaries (on the score rounded to two decimals):
 *   >= 4.10  -> Optimal
 *   >= 3.10  -> Advanced
 *   >= 2.10  -> Initial
 *   >= 1.01  -> Traditional
 *   otherwise -> Not Assessed
 *
 * The comparison happens in integer space (score * 100, rounded) so a score
 * whose float64 representation is 3.099999... but displays as "3.10" via
 * toFixed(2) lands on the same tier the user sees. IEEE 754 cannot represent
 * 4.1 / 3.1 / 2.1 exactly, so `score >= 4.1` would mis-tier boundary inputs;
 * integer comparison removes that ambiguity. See the backend file for the
 * full rationale.
 * @param {number} score - The score on the 1.0-5.0 user-facing scale.
 * @returns {ScoreTier} The HHS-aligned maturity tier.
 */
export function tierForScore(score: number): ScoreTier {
  const hundredths = Math.round(score * 100)
  if (hundredths >= 410) return 'Optimal'
  if (hundredths >= 310) return 'Advanced'
  if (hundredths >= 210) return 'Initial'
  if (hundredths >= 101) return 'Traditional'
  return 'Not Assessed'
}
