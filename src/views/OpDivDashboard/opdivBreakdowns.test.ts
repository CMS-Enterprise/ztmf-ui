import { buildOpDivRows } from './opdivAggregates'
import {
  breakdownByFips,
  breakdownByHosting,
  breakdownByOperatingModel,
  breakdownByServiceModel,
  breakdownByStage,
  partitionBy,
} from './opdivBreakdowns'
import { makeSystem } from './testFixtures'
import type { DashboardMaps } from '@/views/Home/aggregateScores'

const emptyMaps = (): DashboardMaps => ({
  scoreMap: {},
  progressMap: {},
  systemCallMap: {},
  chosenCallMap: {},
})

const rowsFor = (
  systems: ReturnType<typeof makeSystem>[],
  maps = emptyMaps()
) => buildOpDivRows(systems, maps)

const sum = (buckets: { count: number }[]) =>
  buckets.reduce((acc, b) => acc + b.count, 0)

describe('partitionBy', () => {
  it('always sums to the total, with unknowns in their own bucket', () => {
    // A partition that drops rows is how a pie silently stops adding up.
    const rows = rowsFor([
      makeSystem({ fismasystemid: 1, fips: 'High' }),
      makeSystem({ fismasystemid: 2, fips: null }),
      makeSystem({ fismasystemid: 3, fips: null }),
    ])
    const result = breakdownByFips(rows)
    expect(result.total).toBe(3)
    expect(sum(result.buckets)).toBe(3)
    expect(result.buckets).toContainEqual({ label: 'Unknown', count: 2 })
  })

  it('surfaces a value outside the known vocabulary instead of dropping it', () => {
    const rows = rowsFor([
      makeSystem({ fismasystemid: 1, fips: 'High' }),
      makeSystem({ fismasystemid: 2, fips: 'Catastrophic' }),
    ])
    const result = breakdownByFips(rows)
    expect(sum(result.buckets)).toBe(2)
    expect(result.buckets.map((b) => b.label)).toContain('Catastrophic')
  })

  it('keeps the canonical order and omits empty buckets', () => {
    const rows = rowsFor([
      makeSystem({ fismasystemid: 1, fips: 'Low' }),
      makeSystem({ fismasystemid: 2, fips: 'High' }),
    ])
    expect(breakdownByFips(rows).buckets.map((b) => b.label)).toEqual([
      'High',
      'Low',
    ])
  })

  it('returns an empty partition for no rows', () => {
    const result = partitionBy([], () => null)
    expect(result).toEqual({ buckets: [], total: 0 })
  })
})

describe('breakdownByHosting', () => {
  it('reports an unrecorded cloud_system as Unknown, never as on-premises', () => {
    // There is no cloud/on-prem enum; the distinction rides on a tri-state
    // boolean, so defaulting a null to on-premises asserts a hosting model.
    const rows = rowsFor([
      makeSystem({ fismasystemid: 1, cloud_system: true }),
      makeSystem({ fismasystemid: 2, cloud_system: false }),
      makeSystem({ fismasystemid: 3, cloud_system: null }),
    ])
    const result = breakdownByHosting(rows)
    expect(result.buckets).toEqual([
      { label: 'Cloud', count: 1 },
      { label: 'On-premises', count: 1 },
      { label: 'Unknown', count: 1 },
    ])
  })
})

describe('breakdownByOperatingModel', () => {
  it('covers the three real values and nothing else', () => {
    const rows = rowsFor([
      makeSystem({ fismasystemid: 1, goco_coco_gogo: 'GOCO' }),
      makeSystem({ fismasystemid: 2, goco_coco_gogo: 'COCO' }),
      makeSystem({ fismasystemid: 3, goco_coco_gogo: 'GOGO' }),
      makeSystem({ fismasystemid: 4, goco_coco_gogo: null }),
    ])
    const result = breakdownByOperatingModel(rows)
    expect(result.buckets.map((b) => b.label)).toEqual([
      'GOCO',
      'COCO',
      'GOGO',
      'Unknown',
    ])
    expect(sum(result.buckets)).toBe(4)
  })
})

describe('breakdownByStage', () => {
  it('separates never-enrolled systems from enrolled-but-unanswered ones', () => {
    const systems = [
      makeSystem({ fismasystemid: 1 }),
      makeSystem({ fismasystemid: 2 }),
    ]
    const maps = emptyMaps()
    // System 1 was enrolled and left unanswered; system 2 has no row at all.
    maps.scoreMap = { 1: { score: 1.0, tier: 'Not Assessed' } }
    const result = breakdownByStage(buildOpDivRows(systems, maps))
    expect(result.buckets).toEqual([
      { label: 'Not Assessed', count: 1 },
      { label: 'No score', count: 1 },
    ])
  })

  it('orders stages best-first and sums to the system count', () => {
    const systems = [1, 2, 3].map((id) => makeSystem({ fismasystemid: id }))
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 2.5, tier: 'Initial' },
      2: { score: 4.5, tier: 'Optimal' },
      3: { score: 3.5, tier: 'Advanced' },
    }
    const result = breakdownByStage(buildOpDivRows(systems, maps))
    expect(result.buckets.map((b) => b.label)).toEqual([
      'Optimal',
      'Advanced',
      'Initial',
    ])
    expect(sum(result.buckets)).toBe(3)
  })
})

describe('breakdownByServiceModel', () => {
  it('lets one system count toward several models', () => {
    // Multi-select: the counts deliberately exceed the system total, which is
    // why this returns a distinct type that no pie accepts.
    const rows = rowsFor([
      makeSystem({
        fismasystemid: 1,
        cloud_system: true,
        cloud_service_model: ['IaaS', 'PaaS'],
      }),
      makeSystem({
        fismasystemid: 2,
        cloud_system: true,
        cloud_service_model: ['SaaS'],
      }),
    ])
    const result = breakdownByServiceModel(rows)
    expect(result.overlapping).toBe(true)
    expect(result.denominator).toBe(2)
    expect(sum(result.buckets)).toBe(3)
    expect(result.buckets).toEqual([
      { label: 'SaaS', count: 1 },
      { label: 'IaaS', count: 1 },
      { label: 'PaaS', count: 1 },
    ])
  })

  it('counts a cloud system with no model recorded as unspecified', () => {
    const rows = rowsFor([
      makeSystem({
        fismasystemid: 1,
        cloud_system: true,
        cloud_service_model: null,
      }),
      makeSystem({
        fismasystemid: 2,
        cloud_system: true,
        cloud_service_model: [],
      }),
    ])
    const result = breakdownByServiceModel(rows)
    expect(result.unspecified).toBe(2)
    expect(result.denominator).toBe(0)
  })

  it('leaves non-cloud and unknown-hosting systems out of scope entirely', () => {
    const rows = rowsFor([
      makeSystem({ fismasystemid: 1, cloud_system: false }),
      makeSystem({ fismasystemid: 2, cloud_system: null }),
    ])
    const result = breakdownByServiceModel(rows)
    expect(result.unspecified).toBe(0)
    expect(result.denominator).toBe(0)
    expect(result.buckets).toEqual([])
  })

  it('does not let a repeated value inflate its own bucket', () => {
    const rows = rowsFor([
      makeSystem({
        fismasystemid: 1,
        cloud_system: true,
        cloud_service_model: ['SaaS', 'SaaS'],
      }),
    ])
    expect(breakdownByServiceModel(rows).buckets).toEqual([
      { label: 'SaaS', count: 1 },
    ])
  })
})
