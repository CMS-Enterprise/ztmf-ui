import { buildRadarData, radarSeriesLabel } from './radarData'
import type { PillarScore, ScoreAggregate } from '@/types'

// A pillar absent from the comparison call used to plot as previous = 0, which
// drew the line into the centre of the chart.

const ANCHOR: PillarScore[] = [
  { pillarid: 1, pillar: 'Identity', score: 3.5 },
  { pillarid: 2, pillar: 'Devices', score: 2.0 },
]

const comparison = (pillarscores: PillarScore[]): ScoreAggregate => ({
  datacallid: 4,
  fismasystemid: 1001,
  systemscore: 3.0,
  pillarscores,
})

describe('buildRadarData', () => {
  it('carries the comparison score when the pillar exists in both calls', () => {
    expect(
      buildRadarData(
        ANCHOR,
        comparison([
          { pillarid: 1, pillar: 'Identity', score: 2.5 },
          { pillarid: 2, pillar: 'Devices', score: 1.5 },
        ])
      )
    ).toEqual([
      { pillar: 'Identity', current: 3.5, previous: 2.5 },
      { pillar: 'Devices', current: 2.0, previous: 1.5 },
    ])
  })

  it('leaves previous undefined for a pillar the comparison call does not carry', () => {
    const data = buildRadarData(
      ANCHOR,
      comparison([{ pillarid: 1, pillar: 'Identity', score: 2.5 }])
    )

    expect(data[1]).toEqual({
      pillar: 'Devices',
      current: 2.0,
      previous: undefined,
    })
    expect(data[1].previous).not.toBe(0)
  })

  // A comparison missing an earlier pillar must not shift scores onto the wrong spoke.
  it('matches on pillarid, not on position', () => {
    const data = buildRadarData(
      ANCHOR,
      comparison([{ pillarid: 2, pillar: 'Devices', score: 1.5 }])
    )

    expect(data).toEqual([
      { pillar: 'Identity', current: 3.5, previous: undefined },
      { pillar: 'Devices', current: 2.0, previous: 1.5 },
    ])
  })

  it('leaves previous undefined for every pillar when there is no comparison', () => {
    for (const entry of [null, undefined]) {
      expect(buildRadarData(ANCHOR, entry)).toEqual([
        { pillar: 'Identity', current: 3.5, previous: undefined },
        { pillar: 'Devices', current: 2.0, previous: undefined },
      ])
    }
  })

  it('leaves previous undefined when the comparison call has an empty pillar list', () => {
    expect(buildRadarData(ANCHOR, comparison([]))).toEqual([
      { pillar: 'Identity', current: 3.5, previous: undefined },
      { pillar: 'Devices', current: 2.0, previous: undefined },
    ])
  })

  it('returns an empty series when the anchor call has no pillar scores', () => {
    expect(buildRadarData(undefined, null)).toEqual([])
    expect(buildRadarData([], null)).toEqual([])
  })
})

describe('radarSeriesLabel', () => {
  // The tooltip used to label both rows with the comparison call's name.

  it('labels each series with its own data call, as the legend does', () => {
    expect(radarSeriesLabel('current', 'FY26 Q1', 'FY25 Q4')).toBe('FY26 Q1')
    expect(radarSeriesLabel('previous', 'FY26 Q1', 'FY25 Q4')).toBe('FY25 Q4')
  })

  it('labels the single series of a view with no comparison', () => {
    expect(radarSeriesLabel('current', 'Current', 'Previous')).toBe('Current')
  })
})
