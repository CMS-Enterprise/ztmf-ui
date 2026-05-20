import type { ScoreTier } from '@/types'
import { TIER_STYLES, styleForTier } from '@/utils/tierStyles'

/**
 * Regression contract for the HHS tier style map.
 *
 * TIER_STYLES is the single source of truth for tier color tokens used by
 * both the PillarScoresModal and the FismaTable score column. The five
 * tier strings (Optimal, Advanced, Initial, Traditional, Not Assessed)
 * are emitted authoritatively by the backend on /scores/aggregate. If a
 * future PR renames or drops a tier in the ScoreTier union the missing
 * key here surfaces at compile time via `satisfies Record<ScoreTier,...>`;
 * the test below also verifies the runtime shape so a stray accidental
 * color edit (typo in hex, dropped backgroundColor) fails fast.
 */

const allTiers: ScoreTier[] = [
  'Optimal',
  'Advanced',
  'Initial',
  'Traditional',
  'Not Assessed',
]

const hex = /^#[0-9A-Fa-f]{6}$/

test('TIER_STYLES exposes an entry for every ScoreTier value', () => {
  allTiers.forEach((tier) => {
    expect(TIER_STYLES[tier]).toBeDefined()
  })
  expect(Object.keys(TIER_STYLES).sort()).toEqual([...allTiers].sort())
})

test.each(allTiers)('TIER_STYLES[%s] has valid hex color tokens', (tier) => {
  const style = TIER_STYLES[tier]
  expect(style.color).toMatch(hex)
  expect(style.backgroundColor).toMatch(hex)
})

test('styleForTier returns the matching entry for known tiers', () => {
  allTiers.forEach((tier) => {
    expect(styleForTier(tier)).toBe(TIER_STYLES[tier])
  })
})

test('styleForTier returns undefined for an absent tier', () => {
  expect(styleForTier(undefined)).toBeUndefined()
})
