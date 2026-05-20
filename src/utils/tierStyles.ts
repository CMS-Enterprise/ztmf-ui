import type { ScoreTier } from '@/types'

// Color tokens lifted from the prior getMaturityLevel ladder so the tier
// chips render identically once data flips to the HHS scale. Both the
// PillarScoresModal and the FismaTable score column read from this map
// keyed off the authoritative tier string from /scores/aggregate, so
// adjusting a tier color is now a one-file change instead of two.
export const TIER_STYLES: Record<
  ScoreTier,
  { color: string; backgroundColor: string }
> = {
  Optimal: { color: '#0F5C4C', backgroundColor: '#E8F8F6' },
  Advanced: { color: '#6B6200', backgroundColor: '#FEFEF0' },
  Initial: { color: '#A34200', backgroundColor: '#FFF4E6' },
  Traditional: { color: '#663399', backgroundColor: '#F3F0FF' },
  'Not Assessed': { color: '#525252', backgroundColor: '#F8F8F8' },
}

export const styleForTier = (tier: ScoreTier | undefined) =>
  tier ? TIER_STYLES[tier] : undefined
