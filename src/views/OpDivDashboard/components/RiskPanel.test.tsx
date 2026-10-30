import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import RiskPanel from './RiskPanel'
import type { RiskRow, RiskSummary, TargetGap } from '../opdivAggregates'
import { makeSystem } from '../testFixtures'

const risk: RiskSummary = {
  highImpact: 0,
  belowFloor: [],
  atOrAboveFloor: 0,
  unscored: 0,
  unknownImpact: 0,
}

const gap = (over: Partial<TargetGap>): TargetGap => ({
  atOrAbove: 0,
  below: 0,
  noTarget: 0,
  unscored: 0,
  shortfalls: [],
  ...over,
})

describe('RiskPanel targets footer', () => {
  it('says targets are not yet judged when every targeted system is unassessed', () => {
    renderWithProviders(<RiskPanel risk={risk} gap={gap({ unscored: 2 })} />)
    expect(
      screen.getByText(/Targets: none judged yet · 2 not yet assessed/)
    ).toBeInTheDocument()
  })

  it('counts unassessed systems beside the judged ones', () => {
    renderWithProviders(
      <RiskPanel
        risk={risk}
        gap={gap({ atOrAbove: 1, below: 1, unscored: 3 })}
      />
    )
    expect(
      screen.getByText(
        /1 of 2 judged systems at or above their asserted target · 3 not yet assessed/
      )
    ).toBeInTheDocument()
  })

  it('keeps "none asserted" when no system has a target', () => {
    renderWithProviders(<RiskPanel risk={risk} gap={gap({ noTarget: 4 })} />)
    expect(screen.getByText(/Targets: none asserted yet/)).toBeInTheDocument()
  })
})

describe('RiskPanel rows', () => {
  const withRows = (rows: RiskRow[]): RiskSummary => ({
    ...risk,
    highImpact: rows.length,
    belowFloor: rows,
  })

  it('hides the score behind "-" on a Not Assessed row', () => {
    const row: RiskRow = {
      system: makeSystem({ fismaacronym: 'DSTAR' }),
      reasons: ['HVA'],
      score: 1.25,
      tier: 'Not Assessed',
    }
    renderWithProviders(<RiskPanel risk={withRows([row])} gap={gap({})} />)
    expect(screen.getByText('Not Assessed')).toBeInTheDocument()
    expect(screen.getByText('-')).toBeInTheDocument()
    expect(screen.queryByText('1.25')).not.toBeInTheDocument()
  })

  it('shows the score on an assessed row', () => {
    const row: RiskRow = {
      system: makeSystem({ fismaacronym: 'EXEC' }),
      reasons: ['High FIPS'],
      score: 2.5,
      tier: 'Initial',
    }
    renderWithProviders(<RiskPanel risk={withRows([row])} gap={gap({})} />)
    expect(screen.getByText('2.50')).toBeInTheDocument()
    expect(screen.queryByText('-')).not.toBeInTheDocument()
  })
})

describe('RiskPanel header count', () => {
  it('shows the KPI em dash when no system is high impact', () => {
    renderWithProviders(<RiskPanel risk={risk} gap={gap({})} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('-')).not.toBeInTheDocument()
    expect(
      screen.getByText('no system is flagged HVA or High FIPS')
    ).toBeInTheDocument()
  })
})
