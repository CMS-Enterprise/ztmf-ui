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
