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
    })

    expect(
      screen.getByText(hasExactText('Opens Nov 1, 2026'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(hasExactText('Closes Sep 30, 2027'))
    ).toBeInTheDocument()
  })
})

describe('DatacallContextCardView menu', () => {
  const calls: datacall[] = [
    {
      datacallid: 1,
      datacall: 'FY2025 Q3',
      datecreated: '2025-01-01T12:00:00Z',
      deadline: '2025-05-07T12:00:00Z',
    },
    {
      datacallid: 2,
      datacall: 'FY26 ZTM',
      datecreated: '2026-08-03T12:00:00Z',
      deadline: '2026-10-01T12:00:00Z',
    },
    {
      datacallid: 3,
      datacall: 'FY2027 Zero Trust Data Call',
      datecreated: '2026-11-01T12:00:00Z',
      deadline: '2027-09-30T12:00:00Z',
    },
  ]

  const openMenu = async () => {
    render(
      <DatacallContextCardView
        datacalls={calls}
        selectedDatacall={calls[2]}
        onSelect={jest.fn()}
        latestDataCallId={3}
      />
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Select data calls/ })
    )
    return screen.getByRole('menu', { name: 'Data calls' })
  }

  it('lists each call by its name alone, with no agency suffix', async () => {
    const menu = await openMenu()
    for (const call of calls) {
      // The element holding the name carries nothing after it.
      expect(within(menu).getByText(call.datacall).textContent).toBe(
        call.datacall
      )
    }
    expect(menu).not.toHaveTextContent(/- (HHS|CMS)\b/)
  })

  it('groups a descriptive FY-prefixed name under its fiscal year', async () => {
    const menu = await openMenu()
    // Year subheaders read FY####; call names never match the whole pattern.
    const headers = within(menu)
      .getAllByText(/^FY\d{4}$/)
      .map((el) => el.textContent)
    expect(headers).toEqual(['FY2027', 'FY2026', 'FY2025'])
    expect(within(menu).queryByText('Other')).not.toBeInTheDocument()
  })
})
