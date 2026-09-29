import {
  biggestMovers,
  buildTrendSeries,
  pairedDelta,
  pairedTierMovement,
  selectTrendCalls,
  tierDistribution,
} from './opdivTrend'
import { makeSystem } from './testFixtures'
import type { ScoreAggregate, datacall } from '@/types'

const agg = (
  datacallid: number,
  fismasystemid: number,
  systemscore: number
): ScoreAggregate => ({ datacallid, fismasystemid, systemscore })

const calls: datacall[] = [
  {
    datacallid: 10,
    datacall: 'FY24 ZTM',
    datecreated: '2023-10-01T00:00:00Z',
    deadline: '2024-06-30T00:00:00Z',
  },
  {
    datacallid: 20,
    datacall: 'FY25 ZTM',
    datecreated: '2024-10-01T00:00:00Z',
    deadline: '2025-06-30T00:00:00Z',
  },
  // Backfilled historical call: a LOWER deadline behind a HIGHER id.
  {
    datacallid: 99,
    datacall: 'FY23 ZTM',
    datecreated: '2022-10-01T00:00:00Z',
    deadline: '2023-06-30T00:00:00Z',
  },
]

describe('buildTrendSeries', () => {
  it('orders points by deadline, not by datacallid', () => {
    // A backfilled call carries a higher id than the cycles it precedes, so
    // sorting on id would plot history out of order.
    const history = [agg(10, 1, 3), agg(20, 1, 4), agg(99, 1, 2)]
    expect(
      buildTrendSeries(history, new Set([1]), calls).map((p) => p.label)
    ).toEqual(['FY23 ZTM', 'FY24 ZTM', 'FY25 ZTM'])
  })

  it('averages only in-scope systems and reports the count behind a point', () => {
    const history = [agg(10, 1, 4), agg(10, 2, 2), agg(10, 99, 1)]
    const [point] = buildTrendSeries(history, new Set([1, 2]), calls)
    expect(point.avg).toBeCloseTo(3)
    expect(point.n).toBe(2)
  })

  it('drops calls the client cannot name', () => {
    // An unlabeled point has no readable position on a time axis.
    const history = [agg(10, 1, 3), agg(555, 1, 4)]
    const series = buildTrendSeries(history, new Set([1]), calls)
    expect(series.map((p) => p.datacallid)).toEqual([10])
  })

  it('skips absent scores rather than averaging them in as zero', () => {
    const history = [agg(10, 1, 4), agg(10, 2, 0)]
    const [point] = buildTrendSeries(history, new Set([1, 2]), calls)
    expect(point.avg).toBeCloseTo(4)
    expect(point.n).toBe(1)
  })

  it('returns an empty series when no in-scope system was ever scored', () => {
    expect(buildTrendSeries([agg(10, 99, 4)], new Set([1]), calls)).toEqual([])
  })
})

describe('pairedTierMovement', () => {
  const tiered = (
    datacallid: number,
    fismasystemid: number,
    systemtier: ScoreAggregate['systemtier']
  ): ScoreAggregate => ({
    datacallid,
    fismasystemid,
    systemscore: 3,
    systemtier,
  })

  it('nets out systems that changed tier', () => {
    const aggregates = [
      // Moved up.
      tiered(20, 1, 'Advanced'),
      tiered(10, 1, 'Initial'),
      // Moved down.
      tiered(20, 2, 'Initial'),
      tiered(10, 2, 'Advanced'),
      // Unchanged.
      tiered(20, 3, 'Optimal'),
      tiered(10, 3, 'Optimal'),
    ]
    const result = pairedTierMovement(aggregates, new Set([1, 2, 3]), 20, 10)
    expect(result.n).toBe(3)
    // One in, one out of each, so the two cancel.
    expect(result.byTier.Advanced ?? 0).toBe(0)
    expect(result.byTier.Initial ?? 0).toBe(0)
    expect(result.byTier.Optimal).toBeUndefined()
  })

  it('reports a net gain when systems move up', () => {
    const aggregates = [
      tiered(20, 1, 'Advanced'),
      tiered(10, 1, 'Initial'),
      tiered(20, 2, 'Advanced'),
      tiered(10, 2, 'Initial'),
    ]
    const result = pairedTierMovement(aggregates, new Set([1, 2]), 20, 10)
    expect(result.byTier.Advanced).toBe(2)
    expect(result.byTier.Initial).toBe(-2)
  })

  it('ignores a system that only appears in one call', () => {
    // Unpaired, a system that simply skipped a cycle would read as a tier the
    // OpDiv lost.
    const aggregates = [tiered(20, 1, 'Advanced'), tiered(10, 2, 'Initial')]
    const result = pairedTierMovement(aggregates, new Set([1, 2]), 20, 10)
    expect(result.n).toBe(0)
    expect(result.byTier).toEqual({})
  })

  it('ignores systems outside the OpDiv', () => {
    const aggregates = [
      tiered(20, 99, 'Optimal'),
      tiered(10, 99, 'Traditional'),
    ]
    expect(pairedTierMovement(aggregates, new Set([1]), 20, 10).n).toBe(0)
  })
})

describe('pairedDelta', () => {
  it('compares only systems scored in both calls', () => {
    // System 3 sat out the current call. An unpaired average would report an
    // improvement driven purely by who participated.
    const aggregates = [
      agg(20, 1, 4),
      agg(20, 2, 4),
      agg(10, 1, 3),
      agg(10, 2, 3),
      agg(10, 3, 1),
    ]
    const result = pairedDelta(aggregates, new Set([1, 2, 3]), 20, 10)
    expect(result.n).toBe(2)
    expect(result.priorAvg).toBeCloseTo(3)
    expect(result.currentAvg).toBeCloseTo(4)
    expect(result.delta).toBeCloseTo(1)
  })

  it('is null when the two calls share no scored system', () => {
    const aggregates = [agg(20, 1, 4), agg(10, 2, 3)]
    expect(pairedDelta(aggregates, new Set([1, 2]), 20, 10)).toEqual({
      delta: null,
      n: 0,
      currentAvg: null,
      priorAvg: null,
      improved: 0,
      declined: 0,
    })
  })

  it('ignores systems outside the OpDiv on both sides', () => {
    const aggregates = [
      agg(20, 99, 5),
      agg(10, 99, 1),
      agg(20, 1, 3),
      agg(10, 1, 3),
    ]
    const result = pairedDelta(aggregates, new Set([1]), 20, 10)
    expect(result.n).toBe(1)
    expect(result.delta).toBeCloseTo(0)
  })
})

describe('selectTrendCalls', () => {
  const CALLS: datacall[] = [
    {
      datacallid: 1,
      datacall: 'FY23 ZTM',
      datecreated: '',
      deadline: '2023-06-30T00:00:00Z',
    },
    {
      datacallid: 2,
      datacall: 'FY2023 Q4',
      datecreated: '',
      deadline: '2023-09-30T00:00:00Z',
    },
    {
      datacallid: 3,
      datacall: 'FY24 ZTM',
      datecreated: '',
      deadline: '2024-06-30T00:00:00Z',
    },
    {
      datacallid: 4,
      datacall: 'FY2025 Q3',
      datecreated: '',
      deadline: '2025-03-31T00:00:00Z',
    },
    {
      datacallid: 5,
      datacall: 'FY25 ZTM',
      datecreated: '',
      deadline: '2025-06-30T00:00:00Z',
    },
    {
      datacallid: 6,
      datacall: 'FY26 ZTM',
      datecreated: '',
      deadline: '2026-06-30T00:00:00Z',
    },
    {
      datacallid: 7,
      datacall: 'Audit Fields Smoke Cycle',
      datecreated: '',
      deadline: '2099-12-31T00:00:00Z',
    },
  ]

  it('gives a non-CMS OpDiv the annual ZTM cadence only', () => {
    // Mixing cadences on one axis is what made the line oscillate: the annual
    // and quarterly calls cover different populations taking turns.
    expect(selectTrendCalls(CALLS, 'CDC').map((c) => c.datacall)).toEqual([
      'FY23 ZTM',
      'FY24 ZTM',
      'FY25 ZTM',
      'FY26 ZTM',
    ])
  })

  it('gives CMS its quarterly calls plus the shared newest annual cycle', () => {
    // FY26 ZTM is the first cycle both cadences ran, so it joins the CMS
    // series as its latest point - the older ZTM calls do not.
    expect(selectTrendCalls(CALLS, 'CMS').map((c) => c.datacall)).toEqual([
      'FY2023 Q4',
      'FY2025 Q3',
      'FY26 ZTM',
    ])
  })

  it('follows the annual cadence in the aggregate', () => {
    // The only cadence every OpDiv participates in.
    expect(selectTrendCalls(CALLS, null).map((c) => c.datacall)).toEqual([
      'FY23 ZTM',
      'FY24 ZTM',
      'FY25 ZTM',
      'FY26 ZTM',
    ])
  })

  it('drops names outside the known grammar rather than guessing', () => {
    for (const code of ['CMS', 'CDC', null]) {
      expect(
        selectTrendCalls(CALLS, code).map((c) => c.datacall)
      ).not.toContain('Audit Fields Smoke Cycle')
    }
  })

  it('gives CMS only its quarterly calls when no annual cycle exists', () => {
    const quarterlyOnly = CALLS.filter((c) => c.datacall.includes('Q'))
    expect(
      selectTrendCalls(quarterlyOnly, 'CMS').map((c) => c.datacall)
    ).toEqual(['FY2023 Q4', 'FY2025 Q3'])
  })
})

describe('tierDistribution', () => {
  const rows: ScoreAggregate[] = [
    {
      datacallid: 10,
      fismasystemid: 1,
      systemscore: 4.5,
      systemtier: 'Optimal',
    },
    {
      datacallid: 10,
      fismasystemid: 2,
      systemscore: 3.5,
      systemtier: 'Advanced',
    },
    {
      datacallid: 10,
      fismasystemid: 3,
      systemscore: 3.4,
      systemtier: 'Advanced',
    },
    {
      datacallid: 10,
      fismasystemid: 4,
      systemscore: 1.0,
      systemtier: 'Not Assessed',
    },
    // Another call, and a system outside the OpDiv - both must be ignored.
    {
      datacallid: 20,
      fismasystemid: 1,
      systemscore: 2.0,
      systemtier: 'Initial',
    },
    {
      datacallid: 10,
      fismasystemid: 99,
      systemscore: 1.5,
      systemtier: 'Traditional',
    },
  ]
  const ids = new Set([1, 2, 3, 4])

  it('counts the selected call best tier first, omitting empty tiers', () => {
    expect(tierDistribution(rows, ids, 10)).toEqual([
      { tier: 'Optimal', count: 1 },
      { tier: 'Advanced', count: 2 },
      { tier: 'Not Assessed', count: 1 },
    ])
  })

  it('drops rows for systems outside the OpDiv', () => {
    // fismasystemid 99 carries a Traditional row in the same call.
    expect(
      tierDistribution(rows, ids, 10).some((t) => t.tier === 'Traditional')
    ).toBe(false)
  })

  it('ignores rows carrying no tier rather than inventing one', () => {
    const untiered: ScoreAggregate[] = [
      { datacallid: 10, fismasystemid: 1, systemscore: 3.2 },
    ]
    expect(tierDistribution(untiered, ids, 10)).toEqual([])
  })

  it('returns nothing when no call is selected', () => {
    expect(tierDistribution(rows, ids, undefined)).toEqual([])
  })
})

describe('biggestMovers', () => {
  const systems = [1, 2, 3, 4].map((id) => makeSystem({ fismasystemid: id }))
  const rows: ScoreAggregate[] = [
    agg(10, 1, 2.0),
    agg(20, 1, 3.0), // +1.00, the biggest gain
    agg(10, 2, 3.5),
    agg(20, 2, 3.0), // -0.50
    agg(10, 3, 2.5),
    agg(20, 3, 2.5), // unchanged
    // Scored only in the newer call - no movement can be attributed to it.
    agg(20, 4, 4.9),
  ]

  it('ranks each direction by magnitude and names the system', () => {
    const movers = biggestMovers(rows, systems, 20, 10)
    expect(movers.gained.map((m) => m.acronym)).toEqual(['SYS1'])
    expect(movers.gained[0].delta).toBeCloseTo(1.0)
    expect(movers.lost.map((m) => m.acronym)).toEqual(['SYS2'])
    expect(movers.lost[0].delta).toBeCloseTo(-0.5)
  })

  it('pairs by system, so a newly scored system is not movement', () => {
    // SYS4 appears only in call 20. Counting its arrival as a gain would let a
    // changed system mix masquerade as progress.
    const movers = biggestMovers(rows, systems, 20, 10)
    expect(movers.paired).toBe(3)
    expect(
      [...movers.gained, ...movers.lost].map((m) => m.acronym)
    ).not.toContain('SYS4')
  })

  it('counts unchanged systems rather than listing them', () => {
    const movers = biggestMovers(rows, systems, 20, 10)
    expect(movers.unchanged).toBe(1)
  })

  it('treats a move too small to render as no move', () => {
    const hairline: ScoreAggregate[] = [agg(10, 1, 3.0), agg(20, 1, 3.002)]
    const movers = biggestMovers(hairline, systems, 20, 10)
    expect(movers.gained).toEqual([])
    expect(movers.unchanged).toBe(1)
  })

  it('keeps only the requested number at each end', () => {
    const many: ScoreAggregate[] = [1, 2, 3, 4].flatMap((id) => [
      agg(10, id, 1.0),
      agg(20, id, 1.0 + id / 10),
    ])
    expect(biggestMovers(many, systems, 20, 10, 2).gained).toHaveLength(2)
  })

  it('reports nothing when either call is unknown', () => {
    expect(biggestMovers(rows, systems, 20, undefined)).toEqual({
      gained: [],
      lost: [],
      paired: 0,
      unchanged: 0,
    })
  })
})
