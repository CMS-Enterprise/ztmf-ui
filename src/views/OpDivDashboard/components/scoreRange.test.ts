import { scoreRange } from './scoreRange'
import { tierDot } from '@/theme/tokens'
import type { ScoreTier } from '@/types'

// The range value is rendered as large text, so its color has to clear WCAG AA
// against the white card behind it. Computed rather than restated as hexes, so
// a future "just nudge the shade" edit fails here instead of in a 508 scan -
// which is how this arrived: the tile shipped painted from tierDot, and
// Advanced (#C19A00) is 2.66:1 on white, missing even the 3:1 large-text bar.

const WHITE: [number, number, number] = [255, 255, 255]

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

function contrastRatio(hex: string): number {
  const a = relativeLuminance(parseHex(hex))
  const b = relativeLuminance(WHITE)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** One scored system at the given score, so every tier can be reached. */
const at = (score: number) =>
  scoreRange({
    lowest: { score, acronym: 'SYS' },
    highest: { score, acronym: 'SYS' },
    scoredCount: 1,
  })

const TIER_SCORES: [ScoreTier, number][] = [
  ['Optimal', 4.8],
  ['Advanced', 3.5],
  ['Initial', 2.5],
  ['Traditional', 1.5],
]

describe('score range colors', () => {
  it.each(TIER_SCORES)('%s clears WCAG AA as text', (tier, score) => {
    const range = at(score)

    expect(range.low?.tier).toBe(tier)
    expect(contrastRatio(range.low!.color)).toBeGreaterThanOrEqual(4.5)
  })

  it('does not paint the value from the accent-dot palette', () => {
    // tierDot is documented as dots that sit BESIDE a value, not as text. The
    // two palettes must stay distinct, or the next reader borrows the wrong
    // one for the same reason this test exists.
    const used = TIER_SCORES.map(([, score]) => at(score).low?.color)

    for (const color of used) {
      expect(Object.values(tierDot)).not.toContain(color)
    }
  })

  it('colors each end independently when the ends differ', () => {
    const range = scoreRange({
      lowest: { score: 1.5, acronym: 'LOW' },
      highest: { score: 4.8, acronym: 'HIGH' },
      scoredCount: 2,
    })

    expect(range.low?.color).not.toBe(range.high?.color)
    expect(contrastRatio(range.low!.color)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(range.high!.color)).toBeGreaterThanOrEqual(4.5)
  })

  it("uses the API's tier for each end, deriving only when it is absent", () => {
    const range = scoreRange({
      lowest: { score: 3.05, acronym: 'LOW', tier: 'Advanced' },
      highest: { score: 4.8, acronym: 'HIGH' },
      scoredCount: 2,
    })

    expect(range.low?.tier).toBe('Advanced')
    expect(range.high?.tier).toBe('Optimal')
  })

  it('the computation agrees with the failure that put this file here', () => {
    // Guards the math: the shade the tile originally shipped with must still
    // read as a failure.
    expect(contrastRatio(tierDot.Advanced)).toBeLessThan(3)
  })
})
