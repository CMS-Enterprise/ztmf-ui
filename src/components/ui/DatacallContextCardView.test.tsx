import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DatacallContextCardView from './DatacallContextCardView'
import type { datacall } from '@/types'

const renderCall = (selectedDatacall: datacall) =>
  render(
    <DatacallContextCardView
      datacalls={[selectedDatacall]}
      selectedDatacall={selectedDatacall}
      onSelect={jest.fn()}
      latestDataCallId={selectedDatacall.datacallid}
    />
  )

const hasExactText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent === text

describe('DatacallContextCardView date tense', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-21T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('uses past tense for a historical data call', () => {
    renderCall({
      datacallid: 1,
      datacall: 'FY2025 Q3',
      datecreated: '2025-01-01T12:00:00Z',
      deadline: '2025-05-07T12:00:00Z',
      fiscal_year: 2025,
      cadence: 'quarterly',
    })

    expect(
      screen.getByText(hasExactText('Opened Jan 1, 2025'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(hasExactText('Closed May 7, 2025'))
    ).toBeInTheDocument()
  })

  it('uses past tense for the start and future tense for an active call', () => {
    renderCall({
      datacallid: 2,
      datacall: 'FY2026 ZTM',
      datecreated: '2026-08-03T12:00:00Z',
      deadline: '2026-10-01T12:00:00Z',
      fiscal_year: 2026,
      cadence: 'annual',
    })

    expect(
      screen.getByText(hasExactText('Opened Aug 3, 2026'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(hasExactText('Closes Oct 1, 2026'))
    ).toBeInTheDocument()
  })

  it('uses future tense for an upcoming call', () => {
    renderCall({
      datacallid: 3,
      datacall: 'FY2027 ZTM',
      datecreated: '2026-11-01T12:00:00Z',
      deadline: '2027-09-30T12:00:00Z',
      fiscal_year: 2027,
      cadence: 'annual',
    })

    expect(
      screen.getByText(hasExactText('Opens Nov 1, 2026'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(hasExactText('Closes Sep 30, 2027'))
    ).toBeInTheDocument()
  })
})

describe('DatacallContextCardView picker', () => {
  const call = (
    datacallid: number,
    title: string,
    deadline: string,
    fiscal_year: number,
    cadence: datacall['cadence']
  ): datacall => ({
    datacallid,
    datacall: title,
    datecreated: '2024-10-01T00:00:00Z',
    deadline,
    fiscal_year,
    cadence,
  })
  const CALLS = [
    call(1, 'FY2025 Q3', '2025-06-30T00:00:00Z', 2025, 'quarterly'),
    call(2, 'FY25 ZTM', '2025-09-30T00:00:00Z', 2025, 'annual'),
    // A free-text title naming no year, filed under its stored year.
    call(3, 'Zero Trust data call', '2026-09-11T00:00:00Z', 2026, 'annual'),
  ]

  it('groups by the stored fiscal year and shows each title as stored', async () => {
    const user = userEvent.setup()
    render(
      <DatacallContextCardView
        datacalls={CALLS}
        selectedDatacall={CALLS[2]}
        onSelect={jest.fn()}
        latestDataCallId={3}
      />
    )

    await user.click(screen.getByRole('button', { name: /select data calls/i }))
    const menu = screen.getByRole('menu', { name: 'Data calls' })

    // Year headers come from the stored field, newest first.
    expect(within(menu).getByText('FY2026')).toBeInTheDocument()
    expect(within(menu).getByText('FY2025')).toBeInTheDocument()
    expect(menu).toHaveTextContent(
      /^FY2026Zero Trust data call.*FY2025FY25 ZTM/
    )
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Zero Trust data call'),
      expect.stringContaining('FY25 ZTM'),
      expect.stringContaining('FY2025 Q3'),
    ])
    // No agency label is added to any title.
    for (const item of items) {
      expect(item).not.toHaveTextContent(/- (HHS|CMS)/)
    }
  })

  it('names the stored year while aggregating several calls', () => {
    render(
      <DatacallContextCardView
        datacalls={CALLS}
        selectedDatacall={null}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
        latestDataCallId={3}
        activeDatacallIds={[2, 1]}
      />
    )

    expect(
      screen.getByRole('button', {
        name: 'Select data calls (viewing FY2025 - 2 calls)',
      })
    ).toBeInTheDocument()
  })
})
