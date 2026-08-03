import type { ScoreAggregate, ScoreProgress } from '@/types'
import { buildDashboardMaps } from './aggregateScores'

const agg = (fismasystemid: number, systemscore: number): ScoreAggregate => ({
  fismasystemid,
  systemscore,
  datacallid: 0,
})

const prog = (
  fismasystemid: number,
  questionsupdated: number,
  lastupdatedat: string | null
): ScoreProgress =>
  ({
    fismasystemid,
    questionsexpected: 40,
    questionsupdated,
    lastupdatedat,
    updatedsincestart: questionsupdated > 0,
  }) as ScoreProgress

// callIds newest-first: 38 = newer (FY25 ZTM), 3 = older (FY2025 Q3)
const CALL_IDS = [38, 3]

describe('buildDashboardMaps', () => {
  it('unions disjoint single-call systems', () => {
    const { scoreMap, systemCallMap } = buildDashboardMaps(
      CALL_IDS,
      [[agg(1, 80)], [agg(2, 60)]],
      [[prog(1, 40, '2025-09-01')], [prog(2, 40, '2025-05-01')]]
    )
    expect(scoreMap[1].score).toBe(80)
    expect(scoreMap[2].score).toBe(60)
    expect(systemCallMap[1]).toEqual([38])
    expect(systemCallMap[2]).toEqual([3])
  })

  it('includes a system present only in progress (no score row)', () => {
    // A never-started system in the current call: /scores/progress returns a row
    // (40 expected, 0 updated) but there is no aggregate score row yet. It must
    // still land in progressMap so the "Not updated only" facet can see it -
    // keying off scores alone dropped these systems entirely.
    const { scoreMap, progressMap, systemCallMap, chosenCallMap } =
      buildDashboardMaps(
        CALL_IDS,
        [[agg(1, 80)], []], // system 7 has no score row in either call
        [[prog(1, 40, '2025-09-01'), prog(7, 0, null)], []]
      )
    expect(scoreMap[7]).toBeUndefined() // no fake score
    expect(progressMap[7].questionsexpected).toBe(40)
    expect(progressMap[7].questionsupdated).toBe(0)
    expect(systemCallMap[7]).toEqual([38])
    expect(chosenCallMap[7]).toBe(38)
  })

  it('keeps a scored call as chosen when a never-started progress row exists in another call', () => {
    // System 1 is scored + completed in the newer call 38, and has a
    // never-started progress row (0 updated, null lastupdated) in the older call
    // 3. The union now adds call 3 to its idxs, but that never-started row must
    // not win `chosen` (its lastupdated is null -> -1) and blank the real score.
    const { scoreMap, chosenCallMap } = buildDashboardMaps(
      CALL_IDS,
      [[agg(1, 88)], []], // score only in call 38
      [[prog(1, 40, '2025-09-01')], [prog(1, 0, null)]]
    )
    expect(scoreMap[1].score).toBe(88) // scored call kept
    expect(chosenCallMap[1]).toBe(38)
  })

  it('lists a call once for a system in both its scores and progress', () => {
    // System 1 appears in the score AND progress list for call 38; its call list
    // must not double-count that call (the union is deduped per call index).
    const { systemCallMap } = buildDashboardMaps(
      [38],
      [[agg(1, 80)]],
      [[prog(1, 40, '2025-09-01')]]
    )
    expect(systemCallMap[1]).toEqual([38])
  })

  it('shows the call a multi-call system most recently updated, not the newest', () => {
    // System 1 is in both calls; it completed the OLDER call (3) recently and
    // never touched the newer call (38). Expect the older call's score/progress.
    const { scoreMap, progressMap, systemCallMap, chosenCallMap } =
      buildDashboardMaps(
        CALL_IDS,
        [[agg(1, 0)], [agg(1, 89)]], // newer call score 0, older call score 89
        [
          [prog(1, 0, null)], // newer call: never updated
          [prog(1, 40, '2025-05-07')], // older call: completed
        ]
      )
    expect(scoreMap[1].score).toBe(89) // older call wins
    expect(progressMap[1].questionsupdated).toBe(40)
    expect(systemCallMap[1]).toEqual([38, 3]) // both calls recorded
    expect(chosenCallMap[1]).toBe(3) // chosen = the call most recently updated
  })

  it('falls back to the newest call when a system never updated any call', () => {
    const { scoreMap } = buildDashboardMaps(
      CALL_IDS,
      [[agg(1, 12)], [agg(1, 99)]],
      [[prog(1, 0, null)], [prog(1, 0, null)]]
    )
    expect(scoreMap[1].score).toBe(12) // newest (idx 0) fallback
  })

  it('defaults a missing score to 0', () => {
    const { scoreMap } = buildDashboardMaps(
      [1],
      [[{ fismasystemid: 5 } as ScoreAggregate]],
      [[]]
    )
    expect(scoreMap[5].score).toBe(0)
  })

  it('returns empty maps for no calls', () => {
    expect(buildDashboardMaps([], [], [])).toEqual({
      scoreMap: {},
      progressMap: {},
      systemCallMap: {},
      chosenCallMap: {},
    })
  })

  it('tolerates a failed (empty) call result', () => {
    const { scoreMap, progressMap } = buildDashboardMaps(
      CALL_IDS,
      [[agg(1, 70)], []], // older call failed -> []
      [[prog(1, 10, '2025-09-01')], []]
    )
    expect(scoreMap[1].score).toBe(70)
    expect(progressMap[1].questionsupdated).toBe(10)
  })
})
