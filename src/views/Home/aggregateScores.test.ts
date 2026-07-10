import type { ScoreAggregate, ScoreProgress } from '@/types'
import {
  buildScoreMap,
  buildProgressMap,
  buildSystemCallMap,
} from './aggregateScores'

const agg = (fismasystemid: number, systemscore: number): ScoreAggregate => ({
  fismasystemid,
  systemscore,
  datacallid: 0,
})

const prog = (fismasystemid: number, questionsupdated: number): ScoreProgress =>
  ({
    fismasystemid,
    questionsexpected: 40,
    questionsupdated,
    updatedsincestart: questionsupdated > 0,
  }) as ScoreProgress

describe('buildScoreMap', () => {
  it('unions disjoint systems across calls (CMS call + HHS call)', () => {
    const map = buildScoreMap([
      [agg(1, 80), agg(2, 60)], // CMS call
      [agg(3, 90)], // HHS call
    ])
    expect(Object.keys(map)).toEqual(['1', '2', '3'])
    expect(map[1].score).toBe(80)
    expect(map[3].score).toBe(90)
  })

  it('defaults a missing score to 0', () => {
    const map = buildScoreMap([[{ fismasystemid: 5 } as ScoreAggregate]])
    expect(map[5].score).toBe(0)
  })

  it('returns an empty map for no calls', () => {
    expect(buildScoreMap([])).toEqual({})
  })
})

describe('buildProgressMap', () => {
  it('unions progress from several calls, keyed by system', () => {
    const map = buildProgressMap([[prog(1, 0)], [prog(2, 40)]])
    expect(map[1].questionsupdated).toBe(0)
    expect(map[2].questionsupdated).toBe(40)
  })

  it('tolerates an empty call result (partial failure fallback)', () => {
    const map = buildProgressMap([[prog(1, 10)], []])
    expect(Object.keys(map)).toEqual(['1'])
  })
})

describe('buildSystemCallMap', () => {
  const row = (fismasystemid: number, datacallid: number): ScoreAggregate => ({
    fismasystemid,
    datacallid,
    systemscore: 0,
  })

  it('records the single call each system belongs to', () => {
    const map = buildSystemCallMap([
      [row(1, 42), row(2, 42)], // CMS call 42
      [row(3, 43)], // HHS call 43
    ])
    expect(map[1]).toEqual([42])
    expect(map[3]).toEqual([43])
  })

  it('flags a system that appears in more than one active call', () => {
    const map = buildSystemCallMap([[row(1, 42)], [row(1, 43)]])
    expect(map[1]).toEqual([42, 43])
  })

  it('does not duplicate a call id for the same system', () => {
    const map = buildSystemCallMap([[row(1, 42), row(1, 42)]])
    expect(map[1]).toEqual([42])
  })
})
