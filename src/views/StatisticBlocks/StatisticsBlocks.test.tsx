import { render, screen } from '@testing-library/react'
import StatisticsBlocks from './StatisticsBlocks'
import type { FismaSystemType, SystemScoreEntry } from '@/types'

// StatisticsBlocks reads the full active-system list from the outlet context and
// the selection-scoped score map from props. The bug in ztmf-ui#633 was the
// average dividing by the whole context list; these tests pin the denominator to
// the systems that actually have a score.
let mockFismaSystems: FismaSystemType[] = []
jest.mock('../Title/Context', () => ({
  __esModule: true,
  useContextProp: () => ({ fismaSystems: mockFismaSystems }),
}))

const sys = (id: number, acronym: string): FismaSystemType =>
  ({ fismasystemid: id, fismaacronym: acronym }) as FismaSystemType

const score = (
  n: number,
  tier?: SystemScoreEntry['tier']
): SystemScoreEntry => ({
  score: n,
  tier,
})

/**
 * Reads the big numeral out of a stat card located by its eyebrow label.
 * @param {string} label - The card's uppercase eyebrow label text.
 * @returns {string} The card's value text, whitespace-normalized.
 */
const tileValue = (label: string): string => {
  // Typography nodes inside the card Box render in order: label, value, hint.
  const card = screen.getByText(label).parentElement
  const nodes = card?.querySelectorAll('p') ?? []
  return (nodes[1]?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Reads the hint line beside a stat card's value.
 * @param {string} label - The card's eyebrow label text.
 * @returns {string} The hint text, or '' when the card renders none.
 */
const tileHint = (label: string): string => {
  const card = screen.getByText(label).parentElement
  const nodes = card?.querySelectorAll('p') ?? []
  return (nodes[2]?.textContent ?? '').trim()
}

describe('StatisticsBlocks — ztmf-ui#633 selection-scoped scoring', () => {
  afterEach(() => {
    mockFismaSystems = []
  })

  it('averages only over systems with a score, not the full active list', () => {
    // Three active systems, only two answered the selected call. The average must
    // be (2 + 5) / 2 = 3.50, NOT (2 + 5) / 3 = 2.33 (the old diluted denominator).
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB'), sys(3, 'CCC')]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(2, 'Traditional'),
      2: score(5, 'Optimal'),
    }
    render(<StatisticsBlocks scores={scores} />)

    expect(tileValue('Avg ZT score')).toBe('3.50')
  })

  it('shows the scored count scoped to the selection beside the total', () => {
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB'), sys(3, 'CCC')]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(2),
      2: score(5),
    }
    render(<StatisticsBlocks scores={scores} />)

    expect(tileValue('Total systems')).toBe('3')
    expect(tileHint('Total systems')).toBe('2 scored')
  })

  it('counts tier buckets from the backend tiers, not score thresholds', () => {
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB'), sys(3, 'CCC')]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(1.5, 'Traditional'),
      2: score(3, 'Initial'),
      3: score(4.82, 'Advanced'),
    }
    render(<StatisticsBlocks scores={scores} />)

    expect(tileValue('Optimal / Advanced')).toBe('1')
    expect(tileValue('Below initial')).toBe('1')
  })

  it('handles a selection no system participated in without going below scale', () => {
    // No scored systems: average is 0.00 (guarded) and the scored count reads 0.
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    render(<StatisticsBlocks scores={{}} />)

    expect(tileValue('Avg ZT score')).toBe('0.00')
    expect(tileValue('Total systems')).toBe('2')
    expect(tileHint('Total systems')).toBe('0 scored')
  })

  it('formats large totals with thousands separators', () => {
    mockFismaSystems = Array.from({ length: 1342 }, (_, i) =>
      sys(i + 1, `S${i}`)
    )
    const scores: Record<number, SystemScoreEntry> = {
      1: score(3.44),
    }
    render(<StatisticsBlocks scores={scores} />)

    expect(tileValue('Total systems')).toBe('1,342')
  })
})
