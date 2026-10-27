import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import RiskPanel from './RiskPanel'
import type { RiskSummary, TargetGap } from '../opdivAggregates'

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
