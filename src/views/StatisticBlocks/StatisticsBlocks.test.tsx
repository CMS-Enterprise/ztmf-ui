import { render, screen } from '@testing-library/react'
import StatisticsBlocks from './StatisticsBlocks'
import type { FismaSystemType, ScoreProgress, SystemScoreEntry } from '@/types'

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

// A progress row for a system in the selected call(s). `expected` is the number
// of applicable questions; > 0 means the system is part of the call.
const prog = (id: number, expected: number): ScoreProgress =>
  ({
    fismasystemid: id,
    questionsexpected: expected,
    questionsanswered: 0,
    questionsupdated: 0,
    lastupdatedat: null,
    updatedsincestart: false,
  }) as ScoreProgress

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

  it('scopes the denominator to systems in the selected call(s), not the whole inventory', () => {
    // Four active systems. 1, 2, 3 are in the selected call (progress rows); 1
    // and 2 are scored, 3 is not started. System 4 is not in the call at all (no
    // progress row). The tile reads 2 scored / 3 in-call - system 4 is excluded
    // from the denominator instead of permanently counting as unscored.
    mockFismaSystems = [
      sys(1, 'AAA'),
      sys(2, 'BBB'),
      sys(3, 'CCC'),
      sys(4, 'DDD'),
    ]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(2),
      2: score(5),
    }
    const progress: Record<number, ScoreProgress> = {
      1: prog(1, 40),
      2: prog(2, 40),
      3: prog(3, 40),
    }
    render(<StatisticsBlocks scores={scores} progress={progress} />)

    expect(tileValue('Scored / Systems in selected data calls')).toBe('2 / 3')
  })

  it('excludes a system whose questionnaire does not apply (0 expected)', () => {
    // A 0/0 system carries a progress row but has no questions to answer, so it
    // is not part of the call's population and must not inflate the denominator.
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    const scores: Record<number, SystemScoreEntry> = { 1: score(3) }
    const progress: Record<number, ScoreProgress> = {
      1: prog(1, 40),
      2: prog(2, 0),
    }
    render(<StatisticsBlocks scores={scores} progress={progress} />)

    expect(tileValue('Scored / Systems in selected data calls')).toBe('1 / 1')
  })

  it('does not read a false 100% when progress data is unavailable', () => {
    // If the progress fetch fails entirely, the in-call population is unknown.
    // The tile must not collapse to scored / scored (a false "all done"); it
    // shows a 0 denominator so the missing data is visible rather than hidden.
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    const scores: Record<number, SystemScoreEntry> = { 1: score(4) }
    render(<StatisticsBlocks scores={scores} progress={{}} />)

    expect(tileValue('Scored / Systems in selected data calls')).toBe('1 / 0')
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

  it('handles a call no system has started without going below scale', () => {
    // Two systems in the call, none scored yet: average is 0 (guarded), ratio is
    // 0 / 2 (both are in the call), and the lowest tile falls back to 0.00 rather
    // than rendering Infinity.
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    const progress: Record<number, ScoreProgress> = {
      1: prog(1, 40),
      2: prog(2, 40),
    }
    render(<StatisticsBlocks scores={{}} progress={progress} />)

    expect(tileValue('Average System Score')).toBe('0')
    expect(tileValue('Scored / Systems in selected data calls')).toBe('0 / 2')
    expect(tileValue('Lowest System Score:')).toBe('0.00')
  })

  it('formats large totals with thousands separators', () => {
    mockFismaSystems = Array.from({ length: 1342 }, (_, i) =>
      sys(i + 1, `S${i}`)
    )
    const scores: Record<number, SystemScoreEntry> = {
      1: score(3.44),
    }
    // All 1342 systems are in the selected call, so the denominator is 1,342.
    const progress: Record<number, ScoreProgress> = Object.fromEntries(
      mockFismaSystems.map((s) => [s.fismasystemid, prog(s.fismasystemid, 40)])
    )
    render(<StatisticsBlocks scores={scores} progress={progress} />)

    expect(tileValue('Scored / Systems in selected data calls')).toBe(
      '1 / 1,342'
    )
  })
})
