import { averageByPillar, pillarExtremeCounts } from './opdivPillars'
import type { ScoreAggregate } from '@/types'

const agg = (
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

describe('averageByPillar', () => {
  it('averages a pillar over only the systems carrying a row for it', () => {
    // System 2 is reduced-scope: it emits no Devices row at all. Counting that
    // absence as a 0, or dividing by both systems, collapses the average.
    const aggregates = [
      agg(1, [
        [1, 'Identity', 4],
        [2, 'Devices', 2],
      ]),
      agg(2, [[1, 'Identity', 2]]),
    ]
    const result = averageByPillar(aggregates, new Set([1, 2]))
    const devices = result.find((p) => p.pillar === 'Devices')
    expect(devices?.avg).toBeCloseTo(2)
    expect(devices?.n).toBe(1)
    expect(devices?.outOfScope).toBe(1)

    const identity = result.find((p) => p.pillar === 'Identity')
    expect(identity?.avg).toBeCloseTo(3)
    expect(identity?.n).toBe(2)
    expect(identity?.outOfScope).toBe(0)
  })

  it('discards rows for systems outside the OpDiv', () => {
    // The aggregate endpoint is not OpDiv-scopeable and carries no
    // decommissioned filter, so it returns rows this page must ignore.
    const aggregates = [
      agg(1, [[1, 'Identity', 4]]),
      agg(99, [[1, 'Identity', 1]]),
    ]
    const result = averageByPillar(aggregates, new Set([1]))
    expect(result).toHaveLength(1)
    expect(result[0].avg).toBeCloseTo(4)
    expect(result[0].n).toBe(1)
  })

  it('returns the canonical pillar order, not response order', () => {
    const aggregates = [
      agg(1, [
        [5, 'Data', 3],
        [1, 'Identity', 4],
        [3, 'Networks', 2],
      ]),
    ]
    expect(
      averageByPillar(aggregates, new Set([1])).map((p) => p.pillar)
    ).toEqual(['Identity', 'Networks', 'Data'])
  })

  it('ignores rows with no pillar detail', () => {
    const aggregates: ScoreAggregate[] = [
      { datacallid: 1, fismasystemid: 1, systemscore: 3 },
    ]
    expect(averageByPillar(aggregates, new Set([1]))).toEqual([])
  })

  it('returns an empty list when nothing is in scope', () => {
    expect(averageByPillar([], new Set([1]))).toEqual([])
  })

  it('matches the FY26 shape where two of three systems are reduced-scope', () => {
    // Taken from a real FY26 response: one system reports all six pillars,
    // two report four (no Devices, no Applications). Dividing by the scored
    // count instead of the contributing count reported Devices as 1.00 rather
    // than 3.00 and Applications as 1.33 rather than 4.00 - a collapse that
    // reads as catastrophic backsliding rather than a narrower denominator.
    const full = agg(1002, [
      [1, 'Identity', 2],
      [2, 'Devices', 3],
      [3, 'Networks', 2],
      [4, 'Applications', 4],
      [5, 'Data', 5],
      [6, 'CrossCutting', 3],
    ])
    const reduced = (id: number) =>
      agg(id, [
        [1, 'Identity', 4],
        [3, 'Networks', 4],
        [5, 'Data', 4],
        [6, 'CrossCutting', 4],
      ])

    const result = averageByPillar(
      [full, reduced(2016), reduced(2017)],
      new Set([1002, 2016, 2017])
    )
    const byName = Object.fromEntries(result.map((p) => [p.pillar, p]))

    expect(byName.Devices.avg).toBeCloseTo(3.0)
    expect(byName.Devices.n).toBe(1)
    expect(byName.Devices.outOfScope).toBe(2)

    expect(byName.Applications.avg).toBeCloseTo(4.0)
    expect(byName.Applications.n).toBe(1)

    // Pillars every system reports keep the full denominator.
    expect(byName.Identity.n).toBe(3)
    expect(byName.Identity.outOfScope).toBe(0)
  })

  it('bands each average so a bare number reads as a standing', () => {
    const result = averageByPillar(
      [agg(1, [[1, 'Identity', 4.5]])],
      new Set([1])
    )
    expect(result[0].tier).toBe('Optimal')
  })

  it('has no delta without a baseline', () => {
    const result = averageByPillar([agg(1, [[1, 'Identity', 3]])], new Set([1]))
    expect(result[0].delta).toBeNull()
    expect(result[0].deltaN).toBe(0)
  })

  it('pairs the per-pillar delta by system', () => {
    // System 2 sat the prior call out. Averaging each side independently
    // would report movement driven purely by who participated.
    const current = [agg(1, [[1, 'Identity', 4]]), agg(2, [[1, 'Identity', 2]])]
    const prior = [agg(1, [[1, 'Identity', 3]])]
    const result = averageByPillar(current, new Set([1, 2]), prior)
    expect(result[0].delta).toBeCloseTo(1)
    expect(result[0].deltaN).toBe(1)
  })

  it('pairs per pillar, so a reduced-scope pillar compares like for like', () => {
    const current = [
      agg(1, [
        [1, 'Identity', 4],
        [2, 'Devices', 3],
      ]),
      // Reduced scope this cycle: no Devices row at all.
      agg(2, [[1, 'Identity', 3]]),
    ]
    const prior = [
      agg(1, [
        [1, 'Identity', 3],
        [2, 'Devices', 1],
      ]),
      agg(2, [[1, 'Identity', 1]]),
    ]
    const result = averageByPillar(current, new Set([1, 2]), prior)
    const devices = result.find((p) => p.pillar === 'Devices')
    expect(devices?.deltaN).toBe(1)
    expect(devices?.delta).toBeCloseTo(2)
  })
})

describe('pillarExtremeCounts', () => {
  it('counts which pillar is lowest and highest for the most systems', () => {
    // Six averages cannot say this: a mid-range average can mean a few awful
    // systems or uniformly mediocre ones, and those need different responses.
    const aggregates = [
      agg(1, [
        [1, 'Identity', 4],
        [6, 'CrossCutting', 1],
      ]),
      agg(2, [
        [1, 'Identity', 3],
        [6, 'CrossCutting', 2],
      ]),
      agg(3, [
        [1, 'Identity', 1],
        [6, 'CrossCutting', 4],
      ]),
    ]
    const result = pillarExtremeCounts(aggregates, new Set([1, 2, 3]))
    expect(result.weakest).toEqual({ pillar: 'CrossCutting', count: 2 })
    expect(result.strongest).toEqual({ pillar: 'Identity', count: 2 })
    expect(result.systems).toBe(3)
  })

  it('counts a tie once, in canonical pillar order', () => {
    // Otherwise the counts exceed the system total and stop being readable
    // as "for N of M systems".
    const aggregates = [
      agg(1, [
        [1, 'Identity', 2],
        [2, 'Devices', 2],
      ]),
    ]
    const result = pillarExtremeCounts(aggregates, new Set([1]))
    expect(result.weakest).toEqual({ pillar: 'Identity', count: 1 })
    expect(result.systems).toBe(1)
  })

  it('ignores systems outside the OpDiv', () => {
    const aggregates = [
      agg(1, [[1, 'Identity', 2]]),
      agg(99, [[6, 'CrossCutting', 1]]),
    ]
    expect(pillarExtremeCounts(aggregates, new Set([1])).systems).toBe(1)
  })

  it('has no extremes without pillar detail', () => {
    expect(pillarExtremeCounts([], new Set([1]))).toEqual({
      weakest: null,
      strongest: null,
      systems: 0,
    })
  })
})
