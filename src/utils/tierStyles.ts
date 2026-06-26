import type { ScoreTier } from '@/types'

// Two style maps for two different surfaces, both keyed on the
// authoritative tier string from /scores/aggregate.
//
// TIER_STYLES is the legacy alias for TIER_CHIP_STYLES; existing
// PillarScoresModal call sites read it for the chip render. Kept as an
// alias rather than removed so an out-of-tree consumer that imported
// TIER_STYLES does not break.

// Chip palette: soft pastel backgrounds with darker matching text. Used
// inside the Pillar Scores modal where the tier label is rendered as
// text on a small chip; the dark text on light pastel gives AAA
// contrast at chip text size.
export const TIER_CHIP_STYLES: Record<
  ScoreTier,
  { color: string; backgroundColor: string }
> = {
  Optimal: { color: '#0F5C4C', backgroundColor: '#E8F8F6' },
  Advanced: { color: '#6B6200', backgroundColor: '#FEFEF0' },
  Initial: { color: '#A34200', backgroundColor: '#FFF4E6' },
  Traditional: { color: '#663399', backgroundColor: '#F3F0FF' },
  'Not Assessed': { color: '#525252', backgroundColor: '#F8F8F8' },
}

// Cell palette: high-contrast pastel backgrounds picked specifically so
// the table score column passes 508 / WCAG color-distinguishability
// review. These are the original FismaTable cell colors; do not soften
// them without a fresh accessibility pass. The score number renders
// black (default) on top of the bright background; black-on-pastel is
// >10:1 contrast (AAA) for every entry below.
export const TIER_CELL_STYLES: Record<ScoreTier, { backgroundColor: string }> =
  {
    Optimal: { backgroundColor: '#93F0ED' }, // bright teal
    Advanced: { backgroundColor: '#F2FBC4' }, // bright lime
    Initial: { backgroundColor: '#FFD5A5' }, // bright orange
    Traditional: { backgroundColor: '#DAA9EC' }, // bright purple
    'Not Assessed': { backgroundColor: 'transparent' },
  }

// Legacy alias for prior consumers of the single map. New code should
// import TIER_CHIP_STYLES or TIER_CELL_STYLES directly.
export const TIER_STYLES = TIER_CHIP_STYLES

export const styleForTier = (tier: ScoreTier | undefined) =>
  tier ? TIER_CHIP_STYLES[tier] : undefined

export const cellStyleForTier = (tier: ScoreTier | undefined) =>
  tier ? TIER_CELL_STYLES[tier] : undefined

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
