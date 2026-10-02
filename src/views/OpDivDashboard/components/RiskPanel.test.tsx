import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RiskPanel from './RiskPanel'
import { makeSystem } from '../testFixtures'
import type { RiskSummary, TargetGap } from '../opdivAggregates'

const EMPTY_GAP: TargetGap = {
  atOrAbove: 0,
  below: 0,
  noTarget: 0,
  unscored: 0,
  shortfalls: [],
}

const RISK: RiskSummary = {
  highImpact: 4,
  belowFloor: [
    {
      system: makeSystem({ fismasystemid: 7, fismaacronym: 'NCI' }),
      reasons: ['HVA', 'High FIPS'],
      score: 1.8,
      tier: 'Traditional',
    },
  ],
  atOrAboveFloor: 3,
  unscored: 0,
  unknownImpact: 0,
}

const renderPanel = (
  risk: Partial<RiskSummary> = {},
  gap: Partial<TargetGap> = {}
) =>
  render(
    <MemoryRouter>
      <RiskPanel risk={{ ...RISK, ...risk }} gap={{ ...EMPTY_GAP, ...gap }} />
    </MemoryRouter>
  )

describe('RiskPanel', () => {
  it('names each at-risk system, why it qualifies, and where it stands', () => {
    renderPanel()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/of 4 high-impact systems/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'NCI' })
    expect(link).toHaveAttribute('href', '/systems/7')
    const row = link.closest('li') as HTMLElement
    expect(row).toHaveTextContent('HVA')
    expect(row).toHaveTextContent('High FIPS')
    // The tier is spelled out beside its dot, so color is never the only channel.
    expect(row).toHaveTextContent('Traditional')
    expect(row).toHaveTextContent('1.80')
  })

  it('says so plainly when nothing is at risk', () => {
    renderPanel({ belowFloor: [], atOrAboveFloor: 4 })
    expect(
      screen.getByText(/every high-impact system is at Advanced or above/i)
    ).toBeInTheDocument()
  })

  it('distinguishes no high-impact systems from none at risk', () => {
    // A zeroed count over an OpDiv with no flagged systems would read as a
    // clean bill of health rather than as an unanswered question.
    renderPanel({ highImpact: 0, belowFloor: [], atOrAboveFloor: 0 })
    expect(
      screen.getByText(/no system is flagged HVA or High FIPS/i)
    ).toBeInTheDocument()
  })

  it('keeps unscored and unrecorded systems out of the headline count', () => {
    renderPanel({ unscored: 2, unknownImpact: 5 })
    expect(
      screen.getByText(/2 high-impact systems have no score to judge/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/5 systems have no HVA or FIPS designation recorded/i)
    ).toBeInTheDocument()
  })

  it('carries the target summary as one footer line', () => {
    renderPanel({}, { atOrAbove: 9, below: 3, noTarget: 2 })
    expect(
      screen.getByText(
        /9 of 12 judged systems at or above their asserted target/
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/2 with no target set/)).toBeInTheDocument()
  })

  it('says targets are unasserted rather than reporting zero at target', () => {
    renderPanel({}, { noTarget: 14 })
    expect(screen.getByText(/none asserted yet/i)).toBeInTheDocument()
  })
})
