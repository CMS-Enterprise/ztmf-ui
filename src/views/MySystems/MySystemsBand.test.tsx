// The band's panels are exercised by mySystemsAggregates.test.ts; this suite
// covers the shell - the decommissioned stand-down, the collapse preference,
// and the delegate carve-out.

let mockCtx: Record<string, unknown>
jest.mock('@/views/Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

// The body issues the real query stack; stub it so these tests stay about the
// shell. mockData is what the band sees; detailArg records whether the band
// asked for the expensive pillar/history reads.
let mockData: Record<string, unknown>
let detailArg: boolean | undefined
jest.mock('./useMySystemsData', () => ({
  useMySystemsData: (includeDetail?: boolean) => {
    detailArg = includeDetail
    return mockData
  },
}))

jest.mock('@/views/OpDivDashboard/components/OpDivHero', () => () => null)

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MySystemsBand from './MySystemsBand'
import TargetPanel from './components/TargetPanel'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import { readCollapsed, writeCollapsed } from './collapsePreference'
import { makeSystem } from '@/views/OpDivDashboard/testFixtures'

/** A settled band with nothing in it - every panel silent. */
function emptyData(overrides: Record<string, unknown> = {}) {
  return {
    isPending: false,
    isError: false,
    rows: [],
    summary: {
      systemCount: 0,
      scoredCount: 0,
      unscoredCount: 0,
      avgScore: null,
      hvaCount: 0,
      hvaUnknownCount: 0,
      highFipsCount: 0,
      fipsUnknownCount: 0,
      optimalAdvancedCount: 0,
      highest: null,
      lowest: null,
    },
    completion: {
      systemsInCall: 0,
      systemsComplete: 0,
      notStarted: 0,
      awaitingConfirmation: 0,
      questionsExpected: 0,
      questionsAnswered: 0,
      questionsUpdated: 0,
      progressPct: null,
      measuresConfirmations: false,
      lastUpdatedAt: null,
    },
    risk: { highImpact: 0, belowFloor: [], atOrAbove: 0, unscored: 0 },
    targetGap: {
      atOrAbove: 0,
      below: 0,
      noTarget: 0,
      unscored: 0,
      shortfalls: [],
    },
    delta: {
      delta: null,
      n: 0,
      currentAvg: null,
      priorAvg: null,
      improved: 0,
      declined: 0,
    },
    daysRemaining: null,
    priorCall: null,
    completionRows: [],
    notStarted: [],
    noTarget: [],
    movement: [],
    weakestPillars: [],
    bySystem: [],
    pillars: {
      anchorCall: null,
      averages: [],
      extremes: { weakest: null, strongest: null, systems: 0 },
      isPending: false,
    },
    trend: {
      points: [],
      isPending: false,
      isError: false,
      selectedCallId: null,
      selectCall: jest.fn(),
      tiers: [],
      movers: { gained: [], lost: [], paired: 0, unchanged: 0 },
    },
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  detailArg = undefined
  mockData = emptyData()
  mockCtx = {
    showDecommissioned: false,
    fismaSystems: [],
    opdivs: [],
    datacalls: [],
    latestDataCallId: 0,
    selectedDatacall: null,
  }
})

describe('decommissioned stand-down', () => {
  it('explains itself rather than rendering zeroed figures', () => {
    // ?decommissioned=true SWAPS the systems list, so there are no active
    // systems left to summarize - every figure would read zero beside a table
    // full of rows.
    mockCtx.showDecommissioned = true
    renderWithProviders(<MySystemsBand />)

    expect(screen.getByText(/Showing decommissioned systems/i)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /detail/i })
    ).not.toBeInTheDocument()
  })

  it('renders the band normally when the flag is off', () => {
    renderWithProviders(<MySystemsBand />)

    expect(screen.getByText('Your systems at a glance')).toBeVisible()
    expect(
      screen.queryByText(/Showing decommissioned systems/i)
    ).not.toBeInTheDocument()
  })
})

describe('collapse preference', () => {
  it('starts collapsed so the systems table stays within reach', () => {
    // The headline row is always rendered; only the detail is behind this.
    renderWithProviders(<MySystemsBand />)

    const toggle = screen.getByRole('button', { name: /show detail/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('remembers an expansion across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))
    expect(
      screen.getByRole('button', { name: /hide detail/i })
    ).toHaveAttribute('aria-expanded', 'true')

    unmount()
    renderWithProviders(<MySystemsBand />)

    expect(
      screen.getByRole('button', { name: /hide detail/i })
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('survives storage being unavailable', () => {
    // Private mode: reading and writing both throw. The band still renders.
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })

    expect(readCollapsed()).toBe(true)
    expect(() => writeCollapsed(false)).not.toThrow()
    renderWithProviders(<MySystemsBand />)
    expect(screen.getByText('Your systems at a glance')).toBeVisible()

    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('detail panels', () => {
  it('does not fetch the pillar and history detail while collapsed', () => {
    // Those are the expensive reads and the band ships collapsed, so paying
    // for them on every ISSO's first paint would be pure waste.
    renderWithProviders(<MySystemsBand />)

    expect(detailArg).toBe(false)
  })

  it('asks for the detail once expanded', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(detailArg).toBe(true)
  })

  it('says so plainly when every panel would be empty', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(screen.getByText(/Nothing to report yet/i)).toBeVisible()
  })

  it('keeps an all-clear panel rather than hiding good news', async () => {
    // "Every system has progress" is an answer; an absent panel is not.
    mockData = emptyData({
      completion: { systemsInCall: 2 },
      summary: {
        avgScore: 4,
        scoredCount: 2,
        systemCount: 2,
        unscoredCount: 0,
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(
      screen.getByText(/Every system has progress this call/i)
    ).toBeVisible()
    expect(screen.queryByText(/Nothing to report yet/i)).not.toBeInTheDocument()
  })

  it('drops Movement when no system is scored in both calls', async () => {
    // Every row would read "not scored", which says nothing the hero's
    // "no prior call to compare" note does not already say.
    mockData = emptyData({
      priorCall: { datacallid: 1, datacall: 'FY25 ZTM' },
      movement: [
        {
          system: makeSystem({ fismasystemid: 1 }),
          from: null,
          to: 4,
          delta: null,
          direction: 'unpaired',
        },
      ],
    })
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(screen.queryByText('Movement')).not.toBeInTheDocument()
  })

  it('keeps Movement once something actually pairs', async () => {
    mockData = emptyData({
      priorCall: { datacallid: 1, datacall: 'FY25 ZTM' },
      movement: [
        {
          system: makeSystem({ fismasystemid: 1 }),
          from: 3,
          to: 4,
          delta: 1,
          direction: 'gained',
        },
      ],
    })
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(screen.getByText('Movement')).toBeInTheDocument()
  })

  it('drops the trend until there are two points to join', async () => {
    mockData = emptyData({
      trend: {
        points: [{ datacallid: 1, label: 'FY24', deadline: '', avg: 3, n: 1 }],
        isPending: false,
        isError: false,
        tiers: [],
        movers: {},
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(screen.queryByText('Score trend')).not.toBeInTheDocument()
  })
})

describe('target panel carve-out', () => {
  it('names the systems still needing a target', () => {
    renderWithProviders(
      <TargetPanel
        rows={[
          {
            system: makeSystem({ fismasystemid: 4, fismaacronym: 'NOTGT' }),
            tier: 'Initial',
          },
        ]}
        totalSystems={3}
      />
    )

    expect(screen.getByText('NOTGT')).toBeVisible()
    expect(screen.getByText(/1 of 3 with no target set/i)).toBeVisible()
  })

  it('reports an all-clear rather than an empty card', () => {
    renderWithProviders(<TargetPanel rows={[]} totalSystems={3} />)

    expect(
      screen.getByText(/Every system you hold has a target/i)
    ).toBeVisible()
  })
})
