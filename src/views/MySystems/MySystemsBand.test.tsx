// Covers the shell - the decommissioned stand-down, the collapse preference,
// the trend-only detail, and the tiles that filter the systems table. Home's
// suite covers the filter and the jump landing on the table.

let mockCtx: Record<string, unknown>
jest.mock('@/views/Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

// The body issues the real query stack; stub it so these tests stay about the
// shell. historyArg records whether the band asked for the score history.
let mockData: Record<string, unknown>
let historyArg: boolean | undefined
jest.mock('./useMySystemsData', () => ({
  useMySystemsData: (includeHistory?: boolean) => {
    historyArg = includeHistory
    return mockData
  },
}))

jest.mock('@/components/ScoreSummary/ScoreHero', () => () => null)

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MySystemsBand from './MySystemsBand'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import { readCollapsed, writeCollapsed } from './collapsePreference'
import { actionableBandData, emptyBandData } from './testFixtures'

beforeEach(() => {
  window.localStorage.clear()
  historyArg = undefined
  mockData = emptyBandData()
  mockCtx = {
    showDecommissioned: false,
    fismaSystems: [],
    opdivs: [],
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

describe('detail', () => {
  /** The region the toggle controls. */
  function detailRegion() {
    const toggle = screen.getByRole('button', { name: /detail/i })
    return document.getElementById(
      toggle.getAttribute('aria-controls') as string
    ) as HTMLElement
  }

  it('does not fetch the score history while collapsed', () => {
    renderWithProviders(<MySystemsBand />)

    expect(historyArg).toBe(false)
  })

  it('fetches the score history once expanded', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(historyArg).toBe(true)
  })

  it('shows only the score trend when expanded', async () => {
    mockData = emptyBandData({
      trend: {
        ...(emptyBandData().trend as object),
        points: [
          { datacallid: 1, label: 'FY25 ZTM', deadline: '', avg: 3, n: 2 },
          { datacallid: 2, label: 'FY26 ZTM', deadline: '', avg: 3.4, n: 2 },
        ],
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    const detail = detailRegion()
    expect(within(detail).getByText('Score trend')).toBeInTheDocument()
    // One card: the trend, nothing beside it.
    expect(detail.children).toHaveLength(1)
  })

  it("keeps the trend's own explanation when there is nothing to plot", async () => {
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand />)

    await user.click(screen.getByRole('button', { name: /show detail/i }))

    expect(
      within(detailRegion()).getByText(
        'No scored data calls yet for your systems.'
      )
    ).toBeVisible()
  })

  it('wires the toggle to the detail region it controls', () => {
    renderWithProviders(<MySystemsBand />)

    expect(detailRegion()).toBeInTheDocument()
  })
})

describe('tiles that filter the systems table', () => {
  const tableJump = () => ({ targetId: 'systems-table', onJump: jest.fn() })

  beforeEach(() => {
    mockData = actionableBandData()
  })

  it.each(['Not started', 'Answers to confirm'])(
    'hands %s to the table jump',
    async (label) => {
      const jump = tableJump()
      const user = userEvent.setup()
      renderWithProviders(<MySystemsBand tableJump={jump} />)

      await user.click(
        screen.getByRole('button', { name: new RegExp(`^${label}`) })
      )

      expect(jump.onJump).toHaveBeenCalledWith('systems-table')
      // The headline is enough; the detail stays as the reader left it.
      expect(readCollapsed()).toBe(true)
    }
  )

  it('says the tile filters the table', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MySystemsBand tableJump={tableJump()} />)

    await user.hover(screen.getByRole('button', { name: /^Not started/ }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /Filters the systems table/
    )
  })

  it.each(['Not started', 'Answers to confirm'])(
    'leaves %s a plain tile when the filter is unavailable',
    (label) => {
      renderWithProviders(<MySystemsBand />)

      expect(screen.getByText(label)).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: new RegExp(`^${label}`) })
      ).not.toBeInTheDocument()
    }
  )

  it('leaves the risk tile a plain tile', () => {
    renderWithProviders(<MySystemsBand tableJump={tableJump()} />)

    expect(screen.getByText('High impact at risk')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^High impact at risk/ })
    ).not.toBeInTheDocument()
  })
})
