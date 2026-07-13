import type { ScoreTier } from '@/types'
import { TIERS, tierStyle } from '@/utils/tierStyles'

// Regression contract for the HHS tier style map.
// Five tier strings are emitted authoritatively by the backend on
// /scores/aggregate. If a future PR renames or drops a tier in the
// ScoreTier union the missing key surfaces at compile time; the tests
// below also verify the runtime shape so an accidental color edit
// (typo in hex, dropped key) fails fast.

const allTiers: ScoreTier[] = [
  'Optimal',
  'Advanced',
  'Initial',
  'Traditional',
  'Not Assessed',
]

const hex = /^#[0-9A-Fa-f]{6}$/

test('TIERS exposes an entry for every ScoreTier value', () => {
  allTiers.forEach((tier) => {
    expect(TIERS[tier]).toBeDefined()
  })
  expect(Object.keys(TIERS).sort()).toEqual([...allTiers].sort())
})

test.each(allTiers)(
  'TIERS[%s].chip has valid hex color and backgroundColor',
  (tier) => {
    expect(TIERS[tier].chip.color).toMatch(hex)
    expect(TIERS[tier].chip.backgroundColor).toMatch(hex)
  }
)

test.each(allTiers.filter((t) => t !== 'Not Assessed'))(
  'TIERS[%s].cell has a valid hex backgroundColor',
  (tier) => {
    expect(TIERS[tier].cell.backgroundColor).toMatch(hex)
  }
)

test('TIERS["Not Assessed"].cell is transparent so the table row reads as "unknown"', () => {
  expect(TIERS['Not Assessed'].cell.backgroundColor).toBe('transparent')
})

test('tierStyle returns the matching TIERS entry for known tiers', () => {
  allTiers.forEach((tier) => {
    expect(tierStyle(tier)).toBe(TIERS[tier])
  })
})

test('tierStyle returns undefined for an absent tier', () => {
  expect(tierStyle(undefined)).toBeUndefined()
})

test('chip and cell palettes are deliberately distinct so the table keeps 508-passing high-contrast cell colors while the modal keeps chip pastels', () => {
  allTiers
    .filter((t) => t !== 'Not Assessed')
    .forEach((tier) => {
      expect(TIERS[tier].cell.backgroundColor).not.toBe(
        TIERS[tier].chip.backgroundColor
      )
    })
})
