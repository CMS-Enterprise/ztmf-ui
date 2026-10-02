import { buildOpDivRows } from './opdivAggregates'
import { averageByOpDiv } from './opdivByOpDiv'
import { makeSystem } from './testFixtures'
import type { DashboardMaps } from '@/views/Home/aggregateScores'
import type { OpDiv } from '@/types'

const emptyMaps = (): DashboardMaps => ({
  scoreMap: {},
  progressMap: {},
  systemCallMap: {},
  chosenCallMap: {},
})

const OPDIVS: OpDiv[] = [
  {
    opdiv_id: 7,
    code: 'NIH',
    name: 'NIH',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
  },
  {
    opdiv_id: 9,
    code: 'CDC',
    name: 'CDC',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
  },
]

describe('averageByOpDiv', () => {
  it('averages each OpDiv over its own scored systems, best first', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 3, opdiv_id: 9 }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 4.0, tier: 'Advanced' },
      2: { score: 2.0, tier: 'Initial' },
      3: { score: 4.5, tier: 'Optimal' },
    }
    const result = averageByOpDiv(buildOpDivRows(systems, maps), OPDIVS)
    expect(result.map((r) => r.code)).toEqual(['CDC', 'NIH'])
    expect(result[0].avg).toBeCloseTo(4.5)
    expect(result[1].avg).toBeCloseTo(3.0)
    expect(result[1].scored).toBe(2)
  })

  it('sinks an OpDiv with no scored systems below the scored ones', () => {
    // A null average sorted as zero would read as the worst performer rather
    // than as no data.
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 9 }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 1.5, tier: 'Traditional' } }
    const result = averageByOpDiv(buildOpDivRows(systems, maps), OPDIVS)
    expect(result.map((r) => r.code)).toEqual(['NIH', 'CDC'])
    expect(result[1].avg).toBeNull()
    expect(result[1].systems).toBe(1)
  })

  it('groups systems whose OpDiv is missing from the catalog', () => {
    // Real systems in the caller's scope; dropping them would make the
    // per-OpDiv counts disagree with the page's own total.
    const systems = [makeSystem({ fismasystemid: 1, opdiv_id: null })]
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 3, tier: 'Advanced' } }
    const result = averageByOpDiv(buildOpDivRows(systems, maps), OPDIVS)
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('Unassigned')
  })

  it('counts every system, scored or not', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 7 }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 3, tier: 'Advanced' } }
    const [nih] = averageByOpDiv(buildOpDivRows(systems, maps), OPDIVS)
    expect(nih.systems).toBe(2)
    expect(nih.scored).toBe(1)
  })

  it('returns nothing for no rows', () => {
    expect(averageByOpDiv([], OPDIVS)).toEqual([])
  })
})
