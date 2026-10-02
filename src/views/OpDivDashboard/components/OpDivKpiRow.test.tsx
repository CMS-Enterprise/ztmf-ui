import { render, screen } from '@testing-library/react'
import OpDivKpiRow from './OpDivKpiRow'
import { scoreRange } from './scoreRange'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'
import type { CompletionSummary, RiskSummary } from '../opdivAggregates'
import type { PairedDelta } from '../opdivTrend'

const completion: CompletionSummary = {
  systemsInCall: 4,
  systemsComplete: 1,
  notStarted: 2,
  awaitingConfirmation: 0,
  questionsExpected: 40,
  questionsAnswered: 20,
  questionsUpdated: 10,
  progressPct: 25,
  measuresConfirmations: true,
  lastUpdatedAt: null,
}

const risk: RiskSummary = {
  highImpact: 0,
  belowFloor: [],
  atOrAboveFloor: 0,
  unscored: 0,
  unknownImpact: 0,
}

const delta: PairedDelta = {
  delta: null,
  n: 0,
  currentAvg: null,
  priorAvg: null,
  improved: 0,
  declined: 0,
}

describe('scoreRange', () => {
  it('collapses to one value when every scored system sits at the same score', () => {
    // A "5.00-5.00" range describes a difference that does not exist, and two
    // separate Highest/Lowest tiles naming the same system was what this
    // replaced.
    const range = scoreRange({
      lowest: { score: 5, acronym: 'ISB-SURV' },
      highest: { score: 5, acronym: 'ISB-SURV' },
      scoredCount: 2,
    })

    expect(range.low?.text).toBe('5.00')
    expect(range.high).toBeNull()
    expect(range.hint).toBe('all 2 at Optimal')
  })

  it('gives each end the color its own tier earns', () => {
    // Regression: the tile this replaced painted every lowest score with the
    // fixed "down" color, so a floor of 5.00 rendered as an alert. Colouring
    // the pair by the low end alone was the same mistake one step removed - a
    // range reaching Optimal read as Traditional purple. Contrast of these
    // values is pinned separately in scoreRange.test.ts.
    const range = scoreRange({
      lowest: { score: 1.5, acronym: 'LOW' },
      highest: { score: 4.8, acronym: 'HIGH' },
      scoredCount: 2,
    })

    expect(range.low).toMatchObject({
      text: '1.50',
      tier: 'Traditional',
      color: TIER_CHIP_STYLES.Traditional.color,
    })
    expect(range.high).toMatchObject({
      text: '4.80',
      tier: 'Optimal',
      color: TIER_CHIP_STYLES.Optimal.color,
    })
    expect(range.low?.color).not.toBe(range.high?.color)
  })

  it('names both systems when the ends differ', () => {
    const range = scoreRange({
      lowest: { score: 2.4, acronym: 'LOW' },
      highest: { score: 4.8, acronym: 'HIGH' },
      scoredCount: 5,
    })

    expect(range.hint).toBe('LOW low · HIGH high')
  })

  it('says nothing is scored rather than implying a zero', () => {
    const range = scoreRange({ lowest: null, highest: null, scoredCount: 0 })

    expect(range.low).toBeNull()
    expect(range.high).toBeNull()
    expect(range.hint).toBe('nothing scored yet')
  })
})

describe('OpDivKpiRow', () => {
  const summary = {
    systemCount: 4,
    scoredCount: 2,
    unscoredCount: 2,
    avgScore: 3.6,
    hvaCount: 0,
    hvaUnknownCount: 0,
    highFipsCount: 0,
    fipsUnknownCount: 0,
    optimalAdvancedCount: 0,
    highest: { score: 4.8, acronym: 'HIGH' },
    lowest: { score: 2.4, acronym: 'LOW' },
  }

  it('renders both ends of the range as text, not only as color', () => {
    render(
      <OpDivKpiRow
        summary={summary}
        completion={completion}
        risk={risk}
        delta={delta}
        daysRemaining={null}
      />
    )

    expect(screen.getByText('2.40')).toBeInTheDocument()
    expect(screen.getByText('4.80')).toBeInTheDocument()
    expect(screen.getByText('LOW low · HIGH high')).toBeInTheDocument()
  })

  it('reports the carried-forward backlog as its own figure', () => {
    // A subset of Not started, split out because confirming is far cheaper
    // than answering - rolled together, the cheap win was invisible.
    render(
      <OpDivKpiRow
        summary={summary}
        completion={{ ...completion, awaitingConfirmation: 3 }}
        risk={risk}
        delta={delta}
        daysRemaining={null}
      />
    )

    expect(screen.getByText('Answers to confirm')).toBeInTheDocument()
    expect(
      screen.getByText('answered last cycle · unconfirmed')
    ).toBeInTheDocument()
  })

  it('no longer offers separate highest and lowest tiles', () => {
    render(
      <OpDivKpiRow
        summary={summary}
        completion={completion}
        risk={risk}
        delta={delta}
        daysRemaining={null}
      />
    )

    expect(screen.queryByText('Highest score')).not.toBeInTheDocument()
    expect(screen.queryByText('Lowest score')).not.toBeInTheDocument()
    expect(screen.getByText('Score range')).toBeInTheDocument()
  })
})
