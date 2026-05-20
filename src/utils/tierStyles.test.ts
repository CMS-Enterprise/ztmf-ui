import type { ScoreTier } from '@/types'
import {
  TIER_STYLES,
  TIER_CHIP_STYLES,
  TIER_CELL_STYLES,
  styleForTier,
  cellStyleForTier,
} from '@/utils/tierStyles'

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

test('TIER_STYLES is a legacy alias for TIER_CHIP_STYLES', () => {
  expect(TIER_STYLES).toBe(TIER_CHIP_STYLES)
})

test('TIER_CELL_STYLES exposes an entry for every ScoreTier value', () => {
  allTiers.forEach((tier) => {
    expect(TIER_CELL_STYLES[tier]).toBeDefined()
    expect(TIER_CELL_STYLES[tier].backgroundColor).toBeDefined()
  })
})

test.each(allTiers.filter((t) => t !== 'Not Assessed'))(
  'TIER_CELL_STYLES[%s] has a valid hex background',
  (tier) => {
    expect(TIER_CELL_STYLES[tier].backgroundColor).toMatch(hex)
  }
)

test('TIER_CELL_STYLES["Not Assessed"] is transparent so the table row reads as "unknown"', () => {
  expect(TIER_CELL_STYLES['Not Assessed'].backgroundColor).toBe('transparent')
})

test('cellStyleForTier returns the matching cell entry for known tiers', () => {
  allTiers.forEach((tier) => {
    expect(cellStyleForTier(tier)).toBe(TIER_CELL_STYLES[tier])
  })
})

test('cellStyleForTier returns undefined for an absent tier', () => {
  expect(cellStyleForTier(undefined)).toBeUndefined()
})

test('chip and cell palettes are deliberately distinct so the table can keep 508-passing high-contrast cell colors while the modal keeps chip pastels', () => {
  allTiers
    .filter((t) => t !== 'Not Assessed')
    .forEach((tier) => {
      expect(TIER_CELL_STYLES[tier].backgroundColor).not.toBe(
        TIER_CHIP_STYLES[tier].backgroundColor
      )
    })
})
