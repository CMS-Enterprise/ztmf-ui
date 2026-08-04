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

// Read the big numeral out of a tile located by its label. The high/low tiles
// fold an acronym into the label element, so callers pass a regex for those.
const tileValue = (label: string | RegExp): string => {
  const tile = screen.getByText(label).closest('.MuiPaper-root')
  const numeral = tile?.querySelector('h2')
  return (numeral?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('StatisticsBlocks — ztmf-ui#633 selection-scoped scoring', () => {
  afterEach(() => {
    mockFismaSystems = []
  })

  it('averages only over systems with a score, not the full active list', () => {
    // Three active systems, only two answered the selected call. The average must
    // be (2 + 5) / 2 = 3.5, NOT (2 + 5) / 3 = 2.33 (the old diluted denominator).
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB'), sys(3, 'CCC')]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(2, 'Traditional'),
      2: score(5, 'Optimal'),
    }
    render(<StatisticsBlocks scores={scores} />)

    expect(tileValue('Average System Score')).toBe('3.5')
  })

  it('shows the Scored / Total ratio scoped to the selection', () => {
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB'), sys(3, 'CCC')]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(2),
      2: score(5),
    }
    render(<StatisticsBlocks scores={scores} />)

    expect(tileValue('Scored / Total Systems')).toBe('2 / 3')
  })

  it('keeps the average between the lowest and highest displayed scores', () => {
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB'), sys(3, 'CCC')]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(1.5, 'Traditional'),
      2: score(3, 'Initial'),
      3: score(4.82, 'Advanced'),
    }
    render(<StatisticsBlocks scores={scores} />)

    const avg = Number(tileValue('Average System Score'))
    const low = Number(tileValue(/Lowest System Score/))
    const high = Number(tileValue(/Highest System Score/))
    expect(low).toBeLessThanOrEqual(avg)
    expect(avg).toBeLessThanOrEqual(high)
    expect(low).toBe(1.5)
    expect(high).toBe(4.82)
  })

  it('handles a selection no system participated in without going below scale', () => {
    // No scored systems: average is 0 (guarded), ratio is 0 / N, and the lowest
    // tile falls back to 0.00 rather than rendering Infinity.
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    render(<StatisticsBlocks scores={{}} />)

    expect(tileValue('Average System Score')).toBe('0')
    expect(tileValue('Scored / Total Systems')).toBe('0 / 2')
    expect(tileValue('Lowest System Score:')).toBe('0.00')
  })

  it('formats large totals with thousands separators', () => {
    mockFismaSystems = Array.from({ length: 1342 }, (_, i) =>
      sys(i + 1, `S${i}`)
    )
    const scores: Record<number, SystemScoreEntry> = {
      1: score(3.44),
    }
    render(<StatisticsBlocks scores={scores} />)

    expect(tileValue('Scored / Total Systems')).toBe('1 / 1,342')
  })
})
