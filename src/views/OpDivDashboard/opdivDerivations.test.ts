/**
 * The rules behind the OpDiv dashboard's figures, pinned in one place: which
 * call is compared against, what counts as scored or started, how unknowns
 * are kept apart from negatives, and who may see which OpDiv.
 */
import { renderHook } from '@testing-library/react'
import {
  EXTREMES_PER_END,
  EXTREMES_THRESHOLD,
  buildOpDivRows,
  notStartedSystems,
  scopeSystemsToOpDiv,
  splitExtremes,
  summarizeCompletion,
  summarizeOpDiv,
  summarizeRisk,
  summarizeTargetGap,
  type OpDivSystemRow,
} from './opdivAggregates'
import { breakdownByFips, breakdownByServiceModel } from './opdivBreakdowns'
import { averageByOpDiv } from './opdivByOpDiv'
import { MAILTO_MAX_LENGTH, buildOpDivMailto } from './opdivMailto'
import { adminTierRoster, classifyDelegateExpiry } from './opdivPeople'
import {
  averageByPillar,
  pillarExtremeCounts,
  pillarOrder,
} from './opdivPillars'
import {
  biggestMovers,
  buildTrendSeries,
  newestQuarterlyCall,
  pairedDelta,
  selectPriorCall,
  selectTrendCalls,
  trendCadenceFor,
} from './opdivTrend'
import {
  canViewOpDiv,
  parseOpDivParam,
  scopeLoadFailed,
  useOpDivScope,
  visibleOpDivs,
} from './useOpDivScope'
import { makeProgress, makeSystem } from './testFixtures'
import {
  clickedIndex,
  windowContaining,
} from '@/components/ScoreSummary/chartIndex'
import type { DashboardMaps } from '@/views/Home/aggregateScores'
import type {
  DatacallCadence,
  OpDiv,
  ScoreAggregate,
  ScoreTier,
  UserRole,
  datacall,
  userData,
  users,
} from '@/types'

let mockContext: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockContext,
}))

const emptyMaps = (): DashboardMaps => ({
  scoreMap: {},
  progressMap: {},
  systemCallMap: {},
  chosenCallMap: {},
})

const agg = (
  datacallid: number,
  fismasystemid: number,
  systemscore: number
): ScoreAggregate => ({ datacallid, fismasystemid, systemscore })

const withPillars = (
  fismasystemid: number,
  pillars: [number, string, number][]
): ScoreAggregate => ({
  datacallid: 1,
  fismasystemid,
  systemscore: 3,
  systemtier: 'Advanced',
  pillarscores: pillars.map(([pillarid, pillar, score]) => ({
    pillarid,
    pillar,
    score,
  })),
})

describe('cadence', () => {
  const call = (
    datacallid: number,
    name: string,
    deadline: string,
    fiscal_year: number,
    cadence: DatacallCadence
  ): datacall => ({
    datacallid,
    datacall: name,
    datecreated: '',
    deadline,
    fiscal_year,
    cadence,
  })
  const CALLS: datacall[] = [
    call(1, 'FY23 ZTM', '2023-06-30T00:00:00Z', 2023, 'annual'),
    call(2, 'FY2023 Q4', '2023-09-30T00:00:00Z', 2023, 'quarterly'),
    call(3, 'FY24 ZTM', '2024-06-30T00:00:00Z', 2024, 'annual'),
    call(4, 'FY2025 Q3', '2025-03-31T00:00:00Z', 2025, 'quarterly'),
    call(5, 'FY25 ZTM', '2025-06-30T00:00:00Z', 2025, 'annual'),
    call(6, 'FY26 ZTM', '2026-06-30T00:00:00Z', 2026, 'annual'),
  ]
  const names = (cadence: DatacallCadence, calls = CALLS) =>
    selectTrendCalls(calls, cadence).map((c) => c.datacall)
  const byName = (name: string) =>
    CALLS.find((c) => c.datacall === name) as datacall

  it('gives the annual cadence the annual calls only', () => {
    expect(names('annual')).toEqual([
      'FY23 ZTM',
      'FY24 ZTM',
      'FY25 ZTM',
      'FY26 ZTM',
    ])
  })

  it('gives the quarterly cadence its quarterlies plus the annual calls from later fiscal years', () => {
    expect(names('quarterly')).toEqual(['FY2023 Q4', 'FY2025 Q3', 'FY26 ZTM'])
  })

  it('reads the stored cadence, never the title', () => {
    const titled = [
      call(10, 'Spring check-in', '2025-03-31T00:00:00Z', 2025, 'quarterly'),
      call(11, 'Zero Trust data call', '2025-09-30T00:00:00Z', 2025, 'annual'),
      // Looks quarterly by name; stored as annual, so it is annual.
      call(12, 'FY2026 Q1', '2026-09-30T00:00:00Z', 2026, 'annual'),
    ]
    expect(names('annual', titled)).toEqual([
      'Zero Trust data call',
      'FY2026 Q1',
    ])
    expect(names('quarterly', titled)).toEqual(['Spring check-in', 'FY2026 Q1'])
  })

  it('compares against the prior call in the scope own cadence', () => {
    // The next call by deadline is FY2025 Q3, which an annual OpDiv never answered.
    expect(selectPriorCall(CALLS, 'annual', byName('FY25 ZTM'))?.datacall).toBe(
      'FY24 ZTM'
    )
    expect(
      selectPriorCall(CALLS, 'quarterly', byName('FY26 ZTM'))?.datacall
    ).toBe('FY2025 Q3')
    expect(selectPriorCall(CALLS, 'annual', byName('FY23 ZTM'))).toBeNull()
    expect(selectPriorCall(CALLS, 'annual', null)).toBeNull()
  })

  it('finds the newest quarterly call by deadline', () => {
    expect(newestQuarterlyCall(CALLS)?.datacall).toBe('FY2025 Q3')
    expect(
      newestQuarterlyCall(CALLS.filter((c) => c.cadence === 'annual'))
    ).toBeNull()
  })

  it('puts a scope on the quarterly cadence only when its systems took part in the newest quarterly call', () => {
    const quarterlyScores = [agg(4, 1, 3), agg(4, 2, 2)]
    expect(trendCadenceFor(new Set([1, 9]), quarterlyScores)).toBe('quarterly')
    expect(trendCadenceFor(new Set([9]), quarterlyScores)).toBe('annual')
    expect(trendCadenceFor(new Set([1]), [])).toBe('annual')
  })

  it('orders trend points by deadline, not by id', () => {
    // A backfilled call carries a higher id than the cycles it precedes.
    const calls = [
      call(10, 'FY24 ZTM', '2024-06-30T00:00:00Z', 2024, 'annual'),
      call(99, 'FY23 ZTM', '2023-06-30T00:00:00Z', 2023, 'annual'),
    ]
    const history = [agg(10, 1, 3), agg(99, 1, 2), agg(555, 1, 4)]
    expect(
      buildTrendSeries(history, new Set([1]), calls).map((p) => p.label)
    ).toEqual(['FY23 ZTM', 'FY24 ZTM'])
  })

  /**
   * Regression for the move off name parsing, on prod's data calls. Names and
   * the FY2025 Q3 / FY25 ZTM deadlines come from the FY2026 rollover fix
   * (ztmf!501), checked against a prod snapshot; the other ZTM calls close at
   * fiscal year end. FY2023 Q4's and FY26 ZTM's deadlines are assumed. CMS
   * systems sit in every call, including the annual ones (HHS imported a view
   * of them); another OpDiv's systems sit in the annual calls only.
   *
   * The expected lists are what main's name-parsing selection returned for
   * these exact calls, computed from main's code before it was removed: the
   * CMS code got the quarterly series, every other code the annual one.
   */
  describe('on prod-shaped data', () => {
    const CMS_SYSTEMS = new Set([101, 102, 103])
    const OTHER_SYSTEMS = new Set([201, 202])
    const PROD: datacall[] = [
      call(36, 'FY23 ZTM', '2023-09-30T00:00:00Z', 2023, 'annual'),
      call(30, 'FY2023 Q4', '2023-09-15T00:00:00Z', 2023, 'quarterly'),
      call(37, 'FY24 ZTM', '2024-09-30T00:00:00Z', 2024, 'annual'),
      call(31, 'FY2025 Q3', '2025-05-07T00:00:00Z', 2025, 'quarterly'),
      call(38, 'FY25 ZTM', '2025-09-30T00:00:00Z', 2025, 'annual'),
      call(69, 'FY26 ZTM', '2026-09-11T00:00:00Z', 2026, 'annual'),
    ]
    const FY27 = call(
      80,
      'FY27 data call',
      '2027-09-10T00:00:00Z',
      2027,
      'annual'
    )
    const byTitle = (calls: datacall[], title: string) =>
      calls.find((c) => c.datacall === title) as datacall
    const HISTORY: ScoreAggregate[] = [
      ...PROD.flatMap((dc) =>
        [...CMS_SYSTEMS].map((sys) => agg(dc.datacallid, sys, 2.5))
      ),
      ...PROD.filter((dc) => dc.cadence === 'annual').flatMap((dc) =>
        [...OTHER_SYSTEMS].map((sys) => agg(dc.datacallid, sys, 2))
      ),
    ]
    const newestQuarterly = newestQuarterlyCall(PROD) as datacall
    const quarterlyScores = HISTORY.filter(
      (row) => row.datacallid === newestQuarterly.datacallid
    )
    const cmsCadence = trendCadenceFor(CMS_SYSTEMS, quarterlyScores)
    const otherCadence = trendCadenceFor(OTHER_SYSTEMS, quarterlyScores)
    const prior = (
      calls: datacall[],
      cadence: DatacallCadence,
      title: string
    ) =>
      selectPriorCall(calls, cadence, byTitle(calls, title))?.datacall ?? null

    it('decides the cadence on FY2025 Q3: CMS quarterly, the other OpDiv annual', () => {
      expect(newestQuarterly.datacall).toBe('FY2025 Q3')
      expect(cmsCadence).toBe('quarterly')
      expect(otherCadence).toBe('annual')
    })

    it('selects the same CMS series and prior calls as name parsing did', () => {
      expect(names(cmsCadence, PROD)).toEqual([
        'FY2023 Q4',
        'FY2025 Q3',
        'FY26 ZTM',
      ])
      expect(prior(PROD, cmsCadence, 'FY23 ZTM')).toBe('FY2023 Q4')
      expect(prior(PROD, cmsCadence, 'FY2023 Q4')).toBeNull()
      expect(prior(PROD, cmsCadence, 'FY24 ZTM')).toBe('FY2023 Q4')
      expect(prior(PROD, cmsCadence, 'FY2025 Q3')).toBe('FY2023 Q4')
      expect(prior(PROD, cmsCadence, 'FY25 ZTM')).toBe('FY2025 Q3')
      expect(prior(PROD, cmsCadence, 'FY26 ZTM')).toBe('FY2025 Q3')
    })

    it('selects the same series and prior calls for the other OpDiv and the aggregate as name parsing did', () => {
      const annual = ['FY23 ZTM', 'FY24 ZTM', 'FY25 ZTM', 'FY26 ZTM']
      expect(names(otherCadence, PROD)).toEqual(annual)
      expect(names('annual', PROD)).toEqual(annual)
      expect(prior(PROD, otherCadence, 'FY23 ZTM')).toBeNull()
      expect(prior(PROD, otherCadence, 'FY2023 Q4')).toBeNull()
      expect(prior(PROD, otherCadence, 'FY24 ZTM')).toBe('FY23 ZTM')
      expect(prior(PROD, otherCadence, 'FY2025 Q3')).toBe('FY24 ZTM')
      expect(prior(PROD, otherCadence, 'FY25 ZTM')).toBe('FY24 ZTM')
      expect(prior(PROD, otherCadence, 'FY26 ZTM')).toBe('FY25 ZTM')
    })

    it('draws the same points for each OpDiv', () => {
      const labels = (systems: Set<number>, cadence: DatacallCadence) =>
        buildTrendSeries(HISTORY, systems, selectTrendCalls(PROD, cadence)).map(
          (p) => p.label
        )
      expect(labels(CMS_SYSTEMS, cmsCadence)).toEqual([
        'FY2023 Q4',
        'FY2025 Q3',
        'FY26 ZTM',
      ])
      expect(labels(OTHER_SYSTEMS, otherCadence)).toEqual([
        'FY23 ZTM',
        'FY24 ZTM',
        'FY25 ZTM',
        'FY26 ZTM',
      ])
    })

    it('keeps FY26 ZTM in the quarterly series once FY27 exists', () => {
      const withFy27 = [...PROD, FY27]
      expect(names('quarterly', withFy27)).toEqual([
        'FY2023 Q4',
        'FY2025 Q3',
        'FY26 ZTM',
        'FY27 data call',
      ])
      expect(prior(withFy27, 'quarterly', 'FY27 data call')).toBe('FY26 ZTM')
    })

    it('leaves out an annual call from the last quarterly call fiscal year', () => {
      // FY25 ZTM is due after FY2025 Q3 but shares fiscal year 2025 with it,
      // so it is the other population's view of a year CMS already covered.
      const withFy27 = [...PROD, FY27]
      expect(names('quarterly', PROD)).not.toContain('FY25 ZTM')
      expect(names('quarterly', withFy27)).not.toContain('FY25 ZTM')
    })
  })
})

describe('paired comparisons', () => {
  it('compares only systems scored in both calls', () => {
    // System 3 sat out the current call; an unpaired average would report an
    // improvement driven purely by who participated.
    const rows = [
      agg(20, 1, 4),
      agg(20, 2, 4),
      agg(10, 1, 3),
      agg(10, 2, 3),
      agg(10, 3, 1),
    ]
    const result = pairedDelta(rows, new Set([1, 2, 3]), 20, 10)
    expect(result.n).toBe(2)
    expect(result.delta).toBeCloseTo(1)
  })

  it('is null when the calls share no scored system', () => {
    const result = pairedDelta(
      [agg(20, 1, 4), agg(10, 2, 3)],
      new Set([1, 2]),
      20,
      10
    )
    expect(result.delta).toBeNull()
    expect(result.n).toBe(0)
  })

  it('does not count a newly scored system as a mover', () => {
    const systems = [1, 2, 3].map((id) => makeSystem({ fismasystemid: id }))
    const rows = [
      agg(10, 1, 2),
      agg(20, 1, 3), // gained
      agg(10, 2, 3.5),
      agg(20, 2, 3), // lost
      agg(20, 3, 4.9), // only in the newer call
    ]
    const movers = biggestMovers(rows, systems, 20, 10)
    expect(movers.paired).toBe(2)
    expect(movers.gained.map((m) => m.acronym)).toEqual(['SYS1'])
    expect(movers.lost.map((m) => m.acronym)).toEqual(['SYS2'])
  })

  it('averages a pillar over only the systems that report it', () => {
    // A SaaS system emits no Devices row; counting that as 0 collapses the
    // average into what reads as backsliding.
    const rows = [
      withPillars(1, [
        [1, 'Identity', 4],
        [2, 'Devices', 2],
      ]),
      withPillars(2, [[1, 'Identity', 2]]),
    ]
    const result = averageByPillar(rows, new Set([1, 2]))
    const devices = result.find((p) => p.pillar === 'Devices')
    expect(devices).toMatchObject({ n: 1, outOfScope: 1 })
    expect(devices?.avg).toBeCloseTo(2)
    expect(result.find((p) => p.pillar === 'Identity')?.n).toBe(2)
  })

  it('pairs the per-pillar delta by system', () => {
    const current = [
      withPillars(1, [[1, 'Identity', 4]]),
      withPillars(2, [[1, 'Identity', 2]]),
    ]
    const prior = [withPillars(1, [[1, 'Identity', 3]])]
    const [identity] = averageByPillar(current, new Set([1, 2]), prior)
    expect(identity.deltaN).toBe(1)
    expect(identity.delta).toBeCloseTo(1)
  })
})

describe('summarizeOpDiv', () => {
  it('averages over scored systems only, treating a zero as unscored', () => {
    const systems = [1, 2, 3].map((id) => makeSystem({ fismasystemid: id }))
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 4, tier: 'Advanced' },
      2: { score: 3, tier: 'Initial' },
      3: { score: 0, tier: 'Not Assessed' },
    }
    const summary = summarizeOpDiv(buildOpDivRows(systems, maps))
    expect(summary.avgScore).toBeCloseTo(3.5)
    expect(summary.scoredCount).toBe(2)
    expect(summary.unscoredCount).toBe(1)
  })

  it('reports a null average rather than 0 when nothing is scored', () => {
    const summary = summarizeOpDiv(buildOpDivRows([makeSystem()], emptyMaps()))
    expect(summary.avgScore).toBeNull()
  })

  it('takes the tier from the API, not from re-deriving the number', () => {
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 3.5, tier: 'Initial' } }
    const summary = summarizeOpDiv(
      buildOpDivRows([makeSystem({ fismasystemid: 1 })], maps)
    )
    expect(summary.optimalAdvancedCount).toBe(0)
  })

  it('counts a null hva or fips as unknown, never as a negative', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, hva: true, fips: 'High' }),
      makeSystem({ fismasystemid: 2, hva: false, fips: 'Moderate' }),
      makeSystem({ fismasystemid: 3, hva: null, fips: null }),
    ]
    const summary = summarizeOpDiv(buildOpDivRows(systems, emptyMaps()))
    expect(summary).toMatchObject({
      hvaCount: 1,
      hvaUnknownCount: 1,
      highFipsCount: 1,
      fipsUnknownCount: 1,
    })
  })

  it('scopes to active systems of the OpDiv, or everything in the aggregate', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 9 }),
      makeSystem({ fismasystemid: 3, opdiv_id: 7, decommissioned: true }),
      makeSystem({ fismasystemid: 4, opdiv_id: null }),
    ]
    const ids = (opdivId: number | null) =>
      scopeSystemsToOpDiv(systems, opdivId).map((s) => s.fismasystemid)
    expect(ids(7)).toEqual([1])
    expect(ids(null)).toEqual([1, 2, 4])
  })

  it('sinks an OpDiv with no scored systems below the scored ones', () => {
    const opdivs = [
      { opdiv_id: 7, code: 'NIH' },
      { opdiv_id: 9, code: 'CDC' },
    ] as OpDiv[]
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 9 }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 1.5, tier: 'Traditional' } }
    const result = averageByOpDiv(buildOpDivRows(systems, maps), opdivs)
    expect(result.map((r) => r.code)).toEqual(['NIH', 'CDC'])
    expect(result[1].avg).toBeNull()
  })
})

describe('unknown impact', () => {
  const risk = (hva: boolean | null, fips: string | null) =>
    summarizeRisk(
      buildOpDivRows(
        [makeSystem({ fismasystemid: 1, hva, fips: fips as never })],
        emptyMaps()
      )
    )

  it('is unknown when either flag is null and the other is not positive', () => {
    expect(risk(null, null).unknownImpact).toBe(1)
    expect(risk(null, 'Low').unknownImpact).toBe(1)
    expect(risk(false, null).unknownImpact).toBe(1)
  })

  it('is known when the other flag is positive, or both are recorded', () => {
    expect(risk(null, 'High')).toMatchObject({
      unknownImpact: 0,
      highImpact: 1,
    })
    expect(risk(false, 'Moderate').unknownImpact).toBe(0)
  })

  it('flags either signal, names why, and sorts unassessed first', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, hva: true, fips: 'Moderate' }),
      makeSystem({ fismasystemid: 2, hva: false, fips: 'High' }),
      makeSystem({ fismasystemid: 3, hva: true }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 2.2, tier: 'Initial' },
      2: { score: 1.5, tier: 'Traditional' },
      3: { score: 1.0, tier: 'Not Assessed' },
    }
    const result = summarizeRisk(buildOpDivRows(systems, maps))
    expect(result.belowFloor.map((r) => r.system.fismasystemid)).toEqual([
      3, 2, 1,
    ])
    expect(result.belowFloor[2].reasons).toEqual(['HVA'])
  })
})

describe('clickedIndex', () => {
  it('reads the string index recharts 3 passes to onClick', () => {
    expect(clickedIndex({ activeTooltipIndex: '2' })).toBe(2)
    expect(clickedIndex({ activeTooltipIndex: '0' })).toBe(0)
  })

  it('is null when the click hit no point', () => {
    expect(clickedIndex({ activeTooltipIndex: null })).toBeNull()
    expect(clickedIndex({})).toBeNull()
    expect(clickedIndex(null)).toBeNull()
    expect(clickedIndex({ activeTooltipIndex: 'node-a' })).toBeNull()
  })
})

describe('windowContaining', () => {
  const win = { start: 4, end: 6 }

  it('leaves a window that already holds the index', () => {
    expect(windowContaining(win, 5)).toBe(win)
  })

  it('slides just far enough, keeping the width', () => {
    expect(windowContaining(win, 2)).toEqual({ start: 2, end: 4 })
    expect(windowContaining(win, 9)).toEqual({ start: 7, end: 9 })
  })
})

describe('summarizeTargetGap', () => {
  const row = (
    id: number,
    target: string | null,
    tier?: ScoreTier
  ): OpDivSystemRow => ({
    system: makeSystem({
      fismasystemid: id,
      fismaacronym: `SYS${id}`,
      target_maturity_tier: target,
    }),
    tier,
  })

  it('counts a null or unrecognized target as no target, not the Advanced default', () => {
    const gap = summarizeTargetGap([
      row(1, null, 'Traditional'),
      row(2, 'Elite', 'Traditional'),
    ])
    expect(gap).toMatchObject({ noTarget: 2, below: 0, shortfalls: [] })
  })

  it('counts a target with no tier as unscored, not below', () => {
    expect(summarizeTargetGap([row(1, 'Advanced')])).toMatchObject({
      unscored: 1,
      below: 0,
    })
  })

  it('counts a Not Assessed system as unscored, not below', () => {
    expect(
      summarizeTargetGap([row(1, 'Traditional', 'Not Assessed')])
    ).toMatchObject({ unscored: 1, below: 0, shortfalls: [] })
  })

  it('compares tiers by rank', () => {
    const gap = summarizeTargetGap([
      row(1, 'Advanced', 'Initial'),
      row(2, 'Initial', 'Advanced'),
      row(3, 'Initial', 'Initial'),
    ])
    expect(gap).toMatchObject({ below: 1, atOrAbove: 2 })
    expect(gap.shortfalls).toEqual([
      expect.objectContaining({
        actual: 'Initial',
        target: 'Advanced',
        gap: 1,
      }),
    ])
  })

  it('orders shortfalls by gap, then acronym', () => {
    const gap = summarizeTargetGap([
      row(3, 'Advanced', 'Initial'),
      row(1, 'Advanced', 'Initial'),
      row(2, 'Optimal', 'Traditional'),
    ])
    expect(gap.shortfalls.map((s) => s.system.fismasystemid)).toEqual([2, 1, 3])
  })
})

describe('pillarOrder', () => {
  const SIX: [number, string, number][] = [
    [1, 'Identity', 3],
    [2, 'Devices', 3],
    [3, 'Networks', 3],
    [4, 'Applications', 3],
    [5, 'Data', 3],
    [6, 'CrossCutting', 3],
  ]
  const SAAS = SIX.filter(([id]) => id !== 2 && id !== 4)

  it('keeps the order the API serves, not pillarid or name', () => {
    const rows = [
      withPillars(1, [
        [5, 'Data', 3],
        [1, 'Identity', 4],
      ]),
    ]
    expect(averageByPillar(rows, new Set([1])).map((p) => p.pillar)).toEqual([
      'Data',
      'Identity',
    ])
  })

  it('leaves a system with every pillar equal out of the weakest and strongest', () => {
    const flat = SIX.map(
      ([id, name]) => [id, name, 1] as [number, string, number]
    )
    const rows = [
      withPillars(1, flat),
      withPillars(2, flat),
      withPillars(3, [
        [1, 'Identity', 3],
        [2, 'Devices', 1],
        [3, 'Networks', 2],
      ]),
    ]
    expect(pillarExtremeCounts(rows, new Set([1, 2, 3]))).toEqual({
      weakest: { pillar: 'Devices', count: 1 },
      strongest: { pillar: 'Identity', count: 1 },
      systems: 1,
    })
  })

  it('credits no pillar at an end where several are tied', () => {
    const rows = [
      withPillars(1, [
        [1, 'Identity', 1],
        [2, 'Devices', 1],
        [3, 'Networks', 3],
      ]),
    ]
    expect(pillarExtremeCounts(rows, new Set([1]))).toEqual({
      weakest: null,
      strongest: { pillar: 'Networks', count: 1 },
      systems: 1,
    })
  })

  it('slots pillars a SaaS row omits back into place when it comes first', () => {
    expect(pillarOrder([withPillars(1, SAAS), withPillars(2, SIX)])).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
  })

  it('terminates when rows contradict each other', () => {
    const rows = [
      withPillars(1, [
        [1, 'Identity', 3],
        [2, 'Devices', 3],
      ]),
      withPillars(2, [
        [2, 'Devices', 3],
        [1, 'Identity', 3],
      ]),
    ]
    expect(pillarOrder(rows)).toEqual([1, 2])
  })
})

describe('progress', () => {
  const OPEN_CALL = 104

  // A new cycle is seeded with the previous cycle's answers, so an untouched
  // system reports answered === expected while the table shows it awaiting
  // confirmation.
  const rows = () => {
    const systems = [
      makeSystem({ fismasystemid: 1, fismaacronym: 'CARRIED' }),
      makeSystem({ fismasystemid: 2, fismaacronym: 'FRESH' }),
      makeSystem({ fismasystemid: 3, fismaacronym: 'WORKING' }),
      makeSystem({ fismasystemid: 4, fismaacronym: 'OUT' }),
    ]
    const maps = emptyMaps()
    maps.chosenCallMap = { 1: OPEN_CALL, 2: OPEN_CALL, 3: OPEN_CALL }
    maps.progressMap = {
      1: makeProgress(1, {
        questionsexpected: 40,
        questionsanswered: 40,
        questionsupdated: 0,
      }),
      2: makeProgress(2, {
        questionsexpected: 40,
        questionsanswered: 0,
        questionsupdated: 0,
      }),
      3: makeProgress(3, {
        questionsexpected: 40,
        questionsanswered: 40,
        questionsupdated: 12,
      }),
      // Not in the call at all - not "not started".
      4: makeProgress(4, { questionsexpected: 0, questionsanswered: 0 }),
    }
    return buildOpDivRows(systems, maps)
  }

  it('counts an unconfirmed carried-forward system as not started', () => {
    const result = notStartedSystems(rows(), OPEN_CALL, false)
    // Ordered by acronym, and the two kinds of nothing are kept apart.
    expect(
      result.map((r) => [r.row.system.fismaacronym, r.awaitingConfirmation])
    ).toEqual([
      ['CARRIED', true],
      ['FRESH', false],
    ])
  })

  it('does not count it complete, and reports confirmations not answers', () => {
    const completion = summarizeCompletion(rows(), OPEN_CALL, false)
    expect(completion).toMatchObject({
      systemsInCall: 3,
      systemsComplete: 0,
      notStarted: 2,
      awaitingConfirmation: 1,
      measuresConfirmations: true,
    })
    // 12 of 120 confirmed; answered would read 67%.
    expect(completion.progressPct).toBeCloseTo(10)
  })

  it('judges a closed call on answers, since nothing is updated once it ends', () => {
    const completion = summarizeCompletion(rows(), OPEN_CALL, true)
    expect(completion).toMatchObject({
      measuresConfirmations: false,
      systemsComplete: 2,
      notStarted: 1,
    })
  })

  it('can summarize only open-call rows, matching the table filter', () => {
    // One system partly confirmed on the open call, one shown on a closed call
    // at 0/40. Counted together, the tile read "0/2 · all 2 underway".
    const CLOSED_CALL = 90
    const systems = [
      makeSystem({ fismasystemid: 1, fismaacronym: 'WORKING' }),
      makeSystem({ fismasystemid: 2, fismaacronym: 'PAST' }),
    ]
    const maps = emptyMaps()
    maps.chosenCallMap = { 1: OPEN_CALL, 2: CLOSED_CALL }
    maps.progressMap = {
      1: makeProgress(1, {
        questionsexpected: 40,
        questionsanswered: 40,
        questionsupdated: 12,
      }),
      2: makeProgress(2, { questionsexpected: 40, questionsanswered: 0 }),
    }
    const mixed = buildOpDivRows(systems, maps)

    expect(summarizeCompletion(mixed, OPEN_CALL, false)).toMatchObject({
      systemsInCall: 2,
      notStarted: 1,
    })
    const open = summarizeCompletion(mixed, OPEN_CALL, false, true)
    expect(open).toMatchObject({
      systemsInCall: 1,
      notStarted: 0,
      awaitingConfirmation: 0,
      measuresConfirmations: true,
    })
    expect(open.progressPct).toBeCloseTo(30)
  })
})

describe('list caps', () => {
  const bars = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      fismasystemid: i + 1,
      acronym: `S${i + 1}`,
      score: 5 - i * 0.1,
      tier: 'Advanced' as const,
    }))

  it('hides nothing when the list fits', () => {
    const result = splitExtremes(bars(EXTREMES_THRESHOLD))
    expect(result.top).toHaveLength(EXTREMES_THRESHOLD)
    expect(result.hiddenCount).toBe(0)
  })

  it('keeps both ends without overlap and accounts for every system', () => {
    for (const n of [EXTREMES_THRESHOLD + 1, 300]) {
      const result = splitExtremes(bars(n))
      expect(result.top).toHaveLength(EXTREMES_PER_END)
      expect(result.bottom).toHaveLength(EXTREMES_PER_END)
      expect(result.hiddenCount).toBe(n - EXTREMES_PER_END * 2)
    }
  })

  it('keeps only the requested number of movers at each end', () => {
    const systems = [1, 2, 3, 4].map((id) => makeSystem({ fismasystemid: id }))
    const rows = [1, 2, 3, 4].flatMap((id) => [
      agg(10, id, 1),
      agg(20, id, 1 + id / 10),
    ])
    expect(biggestMovers(rows, systems, 20, 10, 2).gained).toHaveLength(2)
  })
})

describe('breakdowns', () => {
  it('always sums to the total, surfacing unknown and off-vocabulary values', () => {
    const rows = buildOpDivRows(
      [
        makeSystem({ fismasystemid: 1, fips: 'High' }),
        makeSystem({ fismasystemid: 2, fips: null }),
        makeSystem({ fismasystemid: 3, fips: 'Catastrophic' }),
      ],
      emptyMaps()
    )
    const { buckets, total } = breakdownByFips(rows)
    expect(total).toBe(3)
    expect(buckets.reduce((acc, b) => acc + b.count, 0)).toBe(3)
    expect(buckets.map((b) => b.label)).toEqual([
      'High',
      'Catastrophic',
      'Unknown',
    ])
  })

  it('lets a system count toward several service models, once each', () => {
    const rows = buildOpDivRows(
      [
        makeSystem({
          fismasystemid: 1,
          cloud_system: true,
          cloud_service_model: ['IaaS', 'IaaS', 'PaaS'],
        }),
        makeSystem({ fismasystemid: 2, cloud_system: false }),
      ],
      emptyMaps()
    )
    const result = breakdownByServiceModel(rows)
    expect(result.denominator).toBe(1)
    expect(result.buckets).toEqual([
      { label: 'IaaS', count: 1 },
      { label: 'PaaS', count: 1 },
    ])
  })
})

describe('people', () => {
  const makePerson = (
    overrides: Partial<users> & { role: UserRole }
  ): users => ({
    userid: 'u',
    email: 'person@example.gov',
    fullname: 'A Person',
    assignedfismasystems: [],
    assignedopdivids: [7],
    ...overrides,
  })

  it('lists admin tiers only, most privileged first then by name', () => {
    const scoped = [
      makePerson({ role: 'OPDIV_ADMIN', fullname: 'Zed' }),
      makePerson({ role: 'ISSO', fullname: 'Ira' }),
      makePerson({ role: 'HHS_ADMIN', fullname: 'Mo' }),
      makePerson({ role: 'OPDIV_ADMIN', fullname: 'Amy' }),
    ]
    expect(adminTierRoster(scoped).map((u) => u.fullname)).toEqual([
      'Mo',
      'Amy',
      'Zed',
    ])
  })

  it('splits delegates by expiry and treats a null expiry as non-lapsing', () => {
    const delegate = (userid: string, access_expires_at: string | null) =>
      makePerson({ role: 'SYSTEM_DELEGATE', userid, access_expires_at })
    const result = classifyDelegateExpiry(
      [
        delegate('expired', '2026-09-01T00:00:00Z'),
        delegate('soon', '2026-10-10T00:00:00Z'),
        delegate('forever', null),
      ],
      new Date('2026-09-24T00:00:00Z')
    )
    expect(result.expired.map((u) => u.userid)).toEqual(['expired'])
    expect(result.expiringSoon.map((u) => u.userid)).toEqual(['soon'])
    expect(result.active.map((u) => u.userid)).toEqual(['forever'])
  })
})

describe('buildOpDivMailto', () => {
  const withEmails = (issoemail: string | null, datacallcontact?: string) =>
    makeSystem({ fismasystemid: 1, issoemail, datacallcontact })

  it('dedupes case-insensitively and skips blanks', () => {
    const result = buildOpDivMailto(
      [
        withEmails('isso@example.gov', 'poc@example.gov'),
        makeSystem({
          fismasystemid: 2,
          issoemail: 'ISSO@example.gov',
          datacallcontact: '   ',
        }),
        withEmails(null),
      ],
      'NIH'
    )
    expect(result.addresses).toEqual(['isso@example.gov', 'poc@example.gov'])
  })

  it('puts recipients in bcc and names the OpDiv in the subject', () => {
    const { href } = buildOpDivMailto([withEmails('a@example.gov')], 'NIH')
    expect(href).toContain('bcc=')
    expect(href).not.toContain('to=')
    expect(decodeURIComponent(href)).toContain('NIH Zero Trust data call')
  })

  it('strips display names so a comma in one cannot split the list', () => {
    const { addresses, href } = buildOpDivMailto(
      [
        withEmails(
          '"Doe, Jane" <jane@example.gov>',
          'poc@example.gov (Pat Contact)'
        ),
      ],
      'NIH'
    )
    expect(addresses).toEqual(['jane@example.gov', 'poc@example.gov'])
    expect(decodeURIComponent(href)).toContain(
      'bcc=jane@example.gov,poc@example.gov&'
    )
  })

  it('drops the recipients rather than let a client truncate them silently', () => {
    const systems = Array.from({ length: 200 }, (_, i) =>
      makeSystem({
        fismasystemid: i + 1,
        issoemail: `a-very-long-address-${i}@example.gov`,
        datacallcontact: undefined,
      })
    )
    const result = buildOpDivMailto(systems, 'NIH')
    expect(result.truncated).toBe(true)
    expect(result.href).not.toContain('bcc=')
    expect(result.href.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH)
    expect(result.addresses).toHaveLength(200)
  })
})

describe('OpDiv scope', () => {
  const makeOpDiv = (opdiv_id: number, code: string, active = true): OpDiv => ({
    opdiv_id,
    code,
    name: code,
    is_parent: false,
    active,
    system_delegate_enabled: false,
  })
  const makeUser = (
    role: UserRole,
    assignedopdivids?: number[] | null
  ): userData => ({
    userid: 'u1',
    email: 'a@example.gov',
    fullname: 'A User',
    role,
    assignedopdivids,
  })
  const CATALOG = [
    makeOpDiv(7, 'NIH'),
    makeOpDiv(9, 'CDC'),
    makeOpDiv(12, 'OLD', false),
  ]
  const codes = (user: userData, systems?: ReturnType<typeof makeSystem>[]) =>
    visibleOpDivs(user, CATALOG, systems).map((o) => o.code)

  it('shows unscoped tiers every active OpDiv, ordered by code', () => {
    expect(codes(makeUser('OWNER'))).toEqual(['CDC', 'NIH'])
  })

  it('narrows OpDiv tiers to their grants, falling back to systems only when absent', () => {
    expect(codes(makeUser('OPDIV_ADMIN', [7]))).toEqual(['NIH'])
    const systems = [makeSystem({ fismasystemid: 1, opdiv_id: 9 })]
    expect(codes(makeUser('OPDIV_ADMIN', null), systems)).toEqual(['CDC'])
    // An empty array is an answer, not a missing one.
    expect(codes(makeUser('OPDIV_ADMIN', []), systems)).toEqual([])
  })

  it('refuses system-scoped tiers however they are granted', () => {
    // An ISSO can carry a legacy OpDiv grant the backend ignores.
    expect(codes(makeUser('ISSO', [7]))).toEqual([])
    expect(canViewOpDiv(makeUser('ISSO', [7]), 7)).toBe(false)
    expect(canViewOpDiv(makeUser('OPDIV_ADMIN', [7]), 9)).toBe(false)
  })

  it('resolves an inactive OpDiv by id but never the aggregate or manage paths', () => {
    expect(parseOpDivParam('12', CATALOG)?.code).toBe('OLD')
    for (const param of ['all', 'manage', '7abc', '', '999', undefined]) {
      expect(parseOpDivParam(param, CATALOG)).toBeNull()
    }
  })

  it('treats a failed, empty /opdivs as a failure, but keeps a cached list usable', () => {
    const userInfo = makeUser('OWNER')
    expect(scopeLoadFailed({ userInfo, opdivs: [], opdivsError: true })).toBe(
      true
    )
    expect(
      scopeLoadFailed({ userInfo, opdivs: CATALOG, opdivsError: true })
    ).toBe(false)
  })

  describe('useOpDivScope', () => {
    const status = (param: string, ctx: Record<string, unknown> = {}) => {
      mockContext = {
        opdivs: CATALOG,
        opdivsLoaded: true,
        fismaSystems: [],
        fismaSystemsLoaded: true,
        userInfo: makeUser('OPDIV_ADMIN', [7]),
        ...ctx,
      }
      return renderHook(() => useOpDivScope(param)).result.current.status
    }

    it('waits for the catalog rather than reporting every id as not found', () => {
      expect(status('7', { opdivs: [], opdivsLoaded: false })).toBe('loading')
    })

    it('reports a failed load as an error, not as not found', () => {
      expect(status('7', { opdivs: [], opdivsError: true })).toBe('error')
    })

    it('separates an OpDiv that exists but is not granted from one that does not', () => {
      expect(status('9')).toBe('denied')
      expect(status('999')).toBe('notfound')
      expect(status('7')).toBe('ok')
    })

    it('offers no aggregate to a caller with one OpDiv', () => {
      expect(status('all')).toBe('notfound')
      expect(status('all', { userInfo: makeUser('OWNER') })).toBe('ok')
    })
  })
})
