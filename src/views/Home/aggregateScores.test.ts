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

  it('shows the call a multi-call system most recently updated, not the newest', () => {
    // System 1 is in both calls; it completed the OLDER call (3) recently and
    // never touched the newer call (38). Expect the older call's score/progress.
    const { scoreMap, progressMap, systemCallMap } = buildDashboardMaps(
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
