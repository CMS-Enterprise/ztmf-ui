import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TrendPanel from './TrendPanel'
import type { Movers, TierCount, TrendPoint } from '../opdivTrend'

const POINTS: TrendPoint[] = [
  {
    datacallid: 1,
    label: 'FY23 ZTM',
    deadline: '2023-06-30',
    avg: 2.64,
    n: 5,
  },
  {
    datacallid: 3,
    label: 'FY25 ZTM',
    deadline: '2025-06-30',
    avg: 2.81,
    n: 7,
  },
  {
    datacallid: 4,
    label: 'FY26 ZTM',
    deadline: '2026-06-30',
    avg: 3.2,
    n: 7,
  },
]

const TIERS: TierCount[] = [
  { tier: 'Optimal', count: 2 },
  { tier: 'Advanced', count: 4 },
  { tier: 'Initial', count: 1 },
]

const MOVERS: Movers = {
  gained: [
    { fismasystemid: 11, acronym: 'NCI', from: 2.8, to: 3.6, delta: 0.8 },
  ],
  lost: [
    { fismasystemid: 12, acronym: 'NEI', from: 3.4, to: 3.1, delta: -0.3 },
  ],
  paired: 7,
  unchanged: 5,
}

const renderPanel = (over: Partial<Parameters<typeof TrendPanel>[0]> = {}) => {
  const onSelectCall = jest.fn()
  render(
    <MemoryRouter>
      <TrendPanel
        points={POINTS}
        isPending={false}
        isError={false}
        selectedCallId={null}
        onSelectCall={onSelectCall}
        tiers={TIERS}
        movers={MOVERS}
        {...over}
      />
    </MemoryRouter>
  )
  return { onSelectCall }
}

describe('TrendPanel', () => {
  it('describes the newest call when nothing is selected', () => {
    // Never blank: a detail strip with no selection would read as broken.
    renderPanel()
    expect(screen.getByText('FY26 ZTM')).toBeInTheDocument()
    expect(screen.getByText('3.20')).toBeInTheDocument()
  })

  it('describes the selected call instead', () => {
    renderPanel({ selectedCallId: 1 })
    expect(screen.getByText('FY23 ZTM')).toBeInTheDocument()
    expect(screen.getByText('2.64')).toBeInTheDocument()
    // First in the series, so there is nothing to compare against.
    expect(screen.getByText('first in series')).toBeInTheDocument()
  })

  it('falls back to the newest call when the selection is not in the series', () => {
    // Switching OpDiv changes the cadence, so a previously selected call may
    // no longer be plotted - describing a call that is not on the chart would
    // be worse than moving the selection.
    renderPanel({ selectedCallId: 999 })
    expect(screen.getByText('FY26 ZTM')).toBeInTheDocument()
  })

  it('steps through the series with the arrows, for readers without a pointer', async () => {
    // recharts marks are not focusable, so without these the chart's own
    // selection would be mouse-only.
    const { onSelectCall } = renderPanel({ selectedCallId: 3 })
    await userEvent.click(
      screen.getByRole('button', { name: /previous data call/i })
    )
    expect(onSelectCall).toHaveBeenCalledWith(1)

    await userEvent.click(
      screen.getByRole('button', { name: /next data call/i })
    )
    expect(onSelectCall).toHaveBeenCalledWith(4)
  })

  it('stops stepping at both ends', () => {
    renderPanel({ selectedCallId: 1 })
    expect(
      screen.getByRole('button', { name: /previous data call/i })
    ).toBeDisabled()
  })

  it('shows the spread the average hides, as counts and shares', () => {
    // The point above it already says 3.20; what it cannot say is whether that
    // came from a uniform OpDiv or a split one.
    renderPanel({ selectedCallId: 4 })
    expect(screen.getByText('Tier mix in FY26 ZTM')).toBeInTheDocument()
    // By title, not text: the detail strip above also names the active point's
    // own tier, which is 'Advanced' here too.
    const advanced = screen.getByTitle('Advanced').closest('li') as HTMLElement
    expect(advanced).toHaveTextContent('4')
    expect(advanced).toHaveTextContent('57%')
  })

  it('names the systems behind the step, with their direction spelled out', () => {
    renderPanel({ selectedCallId: 4 })
    expect(screen.getByText('Biggest movers vs FY25 ZTM')).toBeInTheDocument()
    const gainer = screen.getByRole('link', { name: 'NCI' }).closest('li')
    expect(gainer).toHaveTextContent('2.80 → 3.60')
    // Signed text, so direction never rests on color alone.
    expect(gainer).toHaveTextContent('+0.80')
    expect(
      screen.getByRole('link', { name: 'NEI' }).closest('li')
    ).toHaveTextContent('-0.30')
    // The denominator, so three rows are not read as the whole population.
    expect(
      screen.getByText(/2 of 7 systems scored in both calls changed/)
    ).toBeInTheDocument()
  })

  it('says there is nothing to compare at the start of the series', () => {
    renderPanel({ selectedCallId: 1 })
    expect(screen.getByText('Biggest movers')).toBeInTheDocument()
    expect(screen.getByText(/first call in the series/i)).toBeInTheDocument()
  })

  it('distinguishes no movement from no pairing', () => {
    renderPanel({
      selectedCallId: 4,
      movers: { gained: [], lost: [], paired: 0, unchanged: 0 },
    })
    expect(
      screen.getByText(/no system was scored in both calls/i)
    ).toBeInTheDocument()
  })

  it('lists every call as text, so no value needs a pointer to read', () => {
    renderPanel()
    const line = screen.getByText(/FY23 ZTM 2\.64/)
    expect(line).toHaveTextContent('FY25 ZTM 2.81')
    expect(line).toHaveTextContent('FY26 ZTM 3.20')
  })

  it('says so when there is not enough history to plot', () => {
    renderPanel({ points: [POINTS[0]] })
    expect(
      screen.getByText(/only one scored data call so far/i)
    ).toBeInTheDocument()
  })
})
