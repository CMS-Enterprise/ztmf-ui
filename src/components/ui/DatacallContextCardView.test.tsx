import { render, screen } from '@testing-library/react'
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
