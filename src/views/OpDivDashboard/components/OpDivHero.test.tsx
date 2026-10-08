import { render, screen } from '@testing-library/react'
import OpDivHero from './OpDivHero'
import type { PairedDelta } from '../opdivTrend'

const DELTA: PairedDelta = {
  delta: 0.2,
  n: 12,
  currentAvg: 3.1,
  priorAvg: 2.9,
  improved: 5,
  declined: 1,
}

describe('OpDivHero', () => {
  it('names the paired averages so the delta visibly subtracts', () => {
    // The headline averages every scored system; the delta pairs a subset.
    render(
      <OpDivHero
        avgScore={3}
        scoredCount={20}
        systemCount={25}
        delta={DELTA}
        priorLabel="FY25 ZTM"
      />
    )
    expect(screen.getByText('3.00')).toBeInTheDocument()
    expect(
      screen.getByText(
        '+0.20 vs FY25 ZTM (paired avg 3.10, was 2.90, 12 systems in both)'
      )
    ).toBeInTheDocument()
  })

  it('says when there is nothing to compare against', () => {
    render(
      <OpDivHero
        avgScore={null}
        scoredCount={0}
        systemCount={4}
        delta={{
          ...DELTA,
          delta: null,
          n: 0,
          currentAvg: null,
          priorAvg: null,
        }}
      />
    )
    expect(
      screen.getByText('No prior data call to compare against.')
    ).toBeInTheDocument()
  })

  it('says nothing paired when a prior call exists but shares no scored system', () => {
    render(
      <OpDivHero
        avgScore={3}
        scoredCount={2}
        systemCount={4}
        delta={{
          ...DELTA,
          delta: null,
          n: 0,
          currentAvg: null,
          priorAvg: null,
        }}
        priorLabel="FY25 ZTM"
      />
    )
    expect(
      screen.getByText('No system was scored in both this call and FY25 ZTM.')
    ).toBeInTheDocument()
  })

  it('is a region named by its heading', () => {
    render(
      <OpDivHero avgScore={3} scoredCount={1} systemCount={1} delta={DELTA} />
    )
    expect(
      screen.getByRole('region', { name: 'Overall ZT score' })
    ).toBeInTheDocument()
  })
})
