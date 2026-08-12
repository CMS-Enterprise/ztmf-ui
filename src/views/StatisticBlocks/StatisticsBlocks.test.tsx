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

// A progress row for a system in the selected call(s). `expected` is the
// number of applicable questions; > 0 means the system is part of the call.
const prog = (id: number, expected: number): ScoreProgress =>
  ({
    fismasystemid: id,
    questionsexpected: expected,
    questionsanswered: 0,
    questionsupdated: 0,
    lastupdatedat: null,
    updatedsincestart: false,
  }) as ScoreProgress

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
    const progress: Record<number, ScoreProgress> = {
      1: prog(1, 40),
      2: prog(2, 40),
      3: prog(3, 40),
    }
    render(<StatisticsBlocks scores={scores} progress={progress} />)

    expect(tileValue('Systems in view')).toBe('3')
    expect(tileHint('Systems in view')).toBe('2 scored')
  })

  it('keeps the average between the lowest and highest displayed scores, named by acronym', () => {
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB'), sys(3, 'CCC')]
    const scores: Record<number, SystemScoreEntry> = {
      1: score(1.5, 'Traditional'),
      2: score(3, 'Initial'),
      3: score(4.82, 'Advanced'),
    }
    render(<StatisticsBlocks scores={scores} />)

    const avg = Number(tileValue('Avg ZT score'))
    const low = Number(tileValue('Lowest score'))
    const high = Number(tileValue('Highest score'))
    expect(low).toBeLessThanOrEqual(avg)
    expect(avg).toBeLessThanOrEqual(high)
    expect(low).toBe(1.5)
    expect(high).toBe(4.82)
    // The tiles name the actual best/worst system.
    expect(tileHint('Highest score')).toBe('CCC')
    expect(tileHint('Lowest score')).toBe('AAA')
  })

  it('renders placeholder Highest/Lowest tiles when nothing is scored', () => {
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    const progress: Record<number, ScoreProgress> = {
      1: prog(1, 40),
      2: prog(2, 40),
    }
    render(<StatisticsBlocks scores={{}} progress={progress} />)

    expect(tileValue('Highest score')).toBe('-')
    expect(tileValue('Lowest score')).toBe('-')
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

  it('handles a call no system has started without going below scale', () => {
    // Two systems in the call, none scored yet: average is 0.00 (guarded)
    // and the ratio reads 0 scored of 2 in view.
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    const progress: Record<number, ScoreProgress> = {
      1: prog(1, 40),
      2: prog(2, 40),
    }
    render(<StatisticsBlocks scores={{}} progress={progress} />)

    expect(tileValue('Avg ZT score')).toBe('0.00')
    expect(tileValue('Systems in view')).toBe('2')
    expect(tileHint('Systems in view')).toBe('0 scored')
  })

  it('scopes the denominator to systems in the selected call(s), not the whole inventory', () => {
    // Four active systems. 1, 2, 3 are in the selected call (progress rows);
    // 1 and 2 are scored, 3 is not started. System 4 is not in the call at
    // all (no progress row). The tile reads 3 in view / 2 scored - system 4
    // is excluded from the denominator instead of permanently counting as
    // unscored.
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

    expect(tileValue('Systems in view')).toBe('3')
    expect(tileHint('Systems in view')).toBe('2 scored')
  })

  it('excludes a system whose questionnaire does not apply (0 expected)', () => {
    // A 0/0 system carries a progress row but has no questions to answer, so
    // it is not part of the call's population and must not inflate the
    // denominator.
    mockFismaSystems = [sys(1, 'AAA'), sys(2, 'BBB')]
    const scores: Record<number, SystemScoreEntry> = { 1: score(3) }
    const progress: Record<number, ScoreProgress> = {
      1: prog(1, 40),
      2: prog(2, 0),
    }
    render(<StatisticsBlocks scores={scores} progress={progress} />)

    expect(tileValue('Systems in view')).toBe('1')
    expect(tileHint('Systems in view')).toBe('1 scored')
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

    expect(tileValue('Systems in view')).toBe('1,342')
  })
})
