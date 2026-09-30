import {
  movementBySystem,
  systemCompletionRows,
  systemsWithoutTarget,
  weakestPillarBySystem,
} from './mySystemsAggregates'
import { buildOpDivRows } from '@/views/OpDivDashboard/opdivAggregates'
import { makeProgress, makeSystem } from '@/views/OpDivDashboard/testFixtures'
import type { DashboardMaps } from '@/views/Home/aggregateScores'
import type { FismaSystemType, ScoreAggregate } from '@/types'

const OPEN_CALL = 9
const PRIOR_CALL = 8

/** Rows for the open call, with per-system progress and scores. */
function rowsFor(
  systems: FismaSystemType[],
  maps: Partial<DashboardMaps> = {}
) {
  const full: DashboardMaps = {
    scoreMap: {},
    progressMap: {},
    systemCallMap: {},
    chosenCallMap: Object.fromEntries(
      systems.map((s) => [s.fismasystemid, OPEN_CALL])
    ),
    ...maps,
  }
  return buildOpDivRows(systems, full)
}

describe('systemCompletionRows', () => {
  it('names carried-forward answers nobody has confirmed', () => {
    // The ztmf#659 shape: a full questionnaire seeded from last cycle, with
    // nothing confirmed. It must not read as done.
    const system = makeSystem({ fismasystemid: 1 })
    const rows = rowsFor([system], {
      progressMap: {
        1: makeProgress(1, {
          questionsexpected: 40,
          questionsanswered: 40,
          questionsupdated: 0,
        }),
      },
    })

    const [row] = systemCompletionRows(rows, OPEN_CALL, false)

    expect(row.state).toBe('awaiting-confirmation')
    expect(row.answered).toBe(40)
    expect(row.updated).toBe(0)
    expect(row.unconfirmed).toBe(40)
    expect(row.measuresConfirmations).toBe(true)
  })

  it('reports partial confirmation as the remainder, not the whole', () => {
    const system = makeSystem({ fismasystemid: 1 })
    const rows = rowsFor([system], {
      progressMap: {
        1: makeProgress(1, {
          questionsexpected: 40,
          questionsanswered: 40,
          questionsupdated: 28,
        }),
      },
    })

    const [row] = systemCompletionRows(rows, OPEN_CALL, false)

    expect(row.state).toBe('partial')
    expect(row.unconfirmed).toBe(12)
  })

  it('reports no unconfirmed count once the call has closed', () => {
    // questionsupdated is 0 for everyone on a closed call, so answered minus
    // updated would claim the entire questionnaire is unconfirmed.
    const system = makeSystem({ fismasystemid: 1 })
    const rows = rowsFor([system], {
      progressMap: {
        1: makeProgress(1, {
          questionsexpected: 40,
          questionsanswered: 40,
          questionsupdated: 0,
        }),
      },
    })

    const [row] = systemCompletionRows(rows, OPEN_CALL, true)

    expect(row.state).toBe('complete')
    expect(row.unconfirmed).toBe(0)
    expect(row.measuresConfirmations).toBe(false)
  })

  it('drops systems the call expects nothing from', () => {
    const system = makeSystem({ fismasystemid: 1 })
    const rows = rowsFor([system], {
      progressMap: { 1: makeProgress(1, { questionsexpected: 0 }) },
    })

    expect(systemCompletionRows(rows, OPEN_CALL, false)).toEqual([])
  })

  it('orders the least complete first', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, fismaacronym: 'DONE' }),
      makeSystem({ fismasystemid: 2, fismaacronym: 'BEHIND' }),
    ]
    const rows = rowsFor(systems, {
      progressMap: {
        1: makeProgress(1, { questionsexpected: 10, questionsupdated: 10 }),
        2: makeProgress(2, {
          questionsexpected: 10,
          questionsanswered: 2,
          questionsupdated: 2,
        }),
      },
    })

    expect(
      systemCompletionRows(rows, OPEN_CALL, false).map(
        (r) => r.system.fismaacronym
      )
    ).toEqual(['BEHIND', 'DONE'])
  })
})

describe('systemsWithoutTarget', () => {
  it('names systems with no asserted target', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, target_maturity_tier: 'Advanced' }),
      makeSystem({ fismasystemid: 2, target_maturity_tier: null }),
      makeSystem({ fismasystemid: 3 }),
    ]

    expect(
      systemsWithoutTarget(rowsFor(systems)).map((r) => r.system.fismasystemid)
    ).toEqual([2, 3])
  })

  it('treats a blank string as unasserted', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, target_maturity_tier: '  ' }),
    ]

    expect(systemsWithoutTarget(rowsFor(systems))).toHaveLength(1)
  })
})

describe('movementBySystem', () => {
  const systems = [
    makeSystem({ fismasystemid: 1, fismaacronym: 'GAINED' }),
    makeSystem({ fismasystemid: 2, fismaacronym: 'LOST' }),
    makeSystem({ fismasystemid: 3, fismaacronym: 'HELD' }),
    makeSystem({ fismasystemid: 4, fismaacronym: 'NEW' }),
  ]
  const scores: ScoreAggregate[] = [
    { datacallid: PRIOR_CALL, fismasystemid: 1, systemscore: 3.0 },
    { datacallid: OPEN_CALL, fismasystemid: 1, systemscore: 3.4 },
    { datacallid: PRIOR_CALL, fismasystemid: 2, systemscore: 3.5 },
    { datacallid: OPEN_CALL, fismasystemid: 2, systemscore: 3.1 },
    { datacallid: PRIOR_CALL, fismasystemid: 3, systemscore: 2.5 },
    { datacallid: OPEN_CALL, fismasystemid: 3, systemscore: 2.5 },
    { datacallid: OPEN_CALL, fismasystemid: 4, systemscore: 4.0 },
  ]

  it('keeps every system, including the ones that did not move', () => {
    const moved = movementBySystem(scores, systems, OPEN_CALL, PRIOR_CALL)

    expect(moved).toHaveLength(4)
    expect(moved.map((m) => m.direction)).toEqual([
      'lost',
      'gained',
      'held',
      'unpaired',
    ])
  })

  it('leads with the regression', () => {
    const [first] = movementBySystem(scores, systems, OPEN_CALL, PRIOR_CALL)

    expect(first.system.fismaacronym).toBe('LOST')
    expect(first.delta).toBeCloseTo(-0.4)
  })

  it('reports a system scored in only one call as unpaired, not as a change', () => {
    const [unpaired] = movementBySystem(
      scores,
      systems,
      OPEN_CALL,
      PRIOR_CALL
    ).filter((m) => m.system.fismaacronym === 'NEW')

    expect(unpaired.from).toBeNull()
    expect(unpaired.to).toBe(4.0)
    expect(unpaired.delta).toBeNull()
  })

  it('ignores rows for systems outside the caller scope', () => {
    const stranger: ScoreAggregate[] = [
      { datacallid: OPEN_CALL, fismasystemid: 99, systemscore: 1.2 },
      { datacallid: PRIOR_CALL, fismasystemid: 99, systemscore: 4.9 },
    ]

    const moved = movementBySystem(
      [...scores, ...stranger],
      systems,
      OPEN_CALL,
      PRIOR_CALL
    )

    expect(moved.map((m) => m.system.fismasystemid)).not.toContain(99)
  })
})

describe('weakestPillarBySystem', () => {
  const systems = [
    makeSystem({ fismasystemid: 1, fismaacronym: 'ALPHA' }),
    makeSystem({ fismasystemid: 2, fismaacronym: 'BRAVO' }),
  ]
  const aggregates: ScoreAggregate[] = [
    {
      datacallid: OPEN_CALL,
      fismasystemid: 1,
      systemscore: 3,
      pillarscores: [
        { pillarid: 1, pillar: 'Identity', score: 4 },
        { pillarid: 2, pillar: 'Devices', score: 2 },
        { pillarid: 3, pillar: 'Networks', score: 3 },
      ],
    },
    {
      datacallid: OPEN_CALL,
      fismasystemid: 2,
      systemscore: 2,
      pillarscores: [
        { pillarid: 1, pillar: 'Identity', score: 1.5 },
        { pillarid: 2, pillar: 'Devices', score: 3 },
      ],
    },
  ]

  it('names each system’s lowest pillar, worst system first', () => {
    const weak = weakestPillarBySystem(aggregates, systems)

    expect(weak).toEqual([
      expect.objectContaining({ pillar: 'Identity', score: 1.5 }),
      expect.objectContaining({ pillar: 'Devices', score: 2 }),
    ])
    expect(weak[0].system.fismaacronym).toBe('BRAVO')
  })

  it('measures the drop against the system’s own pillar average', () => {
    const [, alpha] = weakestPillarBySystem(aggregates, systems)

    // Alpha averages 3 across its three pillars and is weakest at 2.
    expect(alpha.belowOwnAverage).toBeCloseTo(1)
  })

  it('skips systems with no pillar detail rather than inventing a zero', () => {
    const noPillars: ScoreAggregate[] = [
      { datacallid: OPEN_CALL, fismasystemid: 1, systemscore: 3 },
    ]

    expect(weakestPillarBySystem(noPillars, systems)).toEqual([])
  })

  it('averages only the pillars a system actually carries', () => {
    // A SaaS system is scored on fewer pillars; dividing by the full pillar
    // count would understate its average and overstate the gap.
    const [bravo] = weakestPillarBySystem(aggregates, systems)

    // Bravo carries 1.5 and 3, averaging 2.25, so the gap is 0.75.
    expect(bravo.belowOwnAverage).toBeCloseTo(0.75)
  })
})
