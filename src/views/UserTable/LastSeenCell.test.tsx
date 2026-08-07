import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LastSeenCell from './LastSeenCell'
import { LAST_SEEN_EMPTY_LABEL } from './lastSeen'

describe('LastSeenCell', () => {
  const now = new Date('2026-08-07T12:00:00Z')

  it('renders the neutral empty state for null (never blank)', () => {
    render(<LastSeenCell value={null} now={now} />)
    expect(screen.getByText(LAST_SEEN_EMPTY_LABEL)).toBeInTheDocument()
  })

  it('renders relative time for a recorded timestamp', () => {
    render(<LastSeenCell value={new Date('2026-08-04T12:00:00Z')} now={now} />)
    expect(screen.getByText('3 days ago')).toBeInTheDocument()
  })

  it('exposes the absolute timestamp as a tooltip on hover', async () => {
    const user = userEvent.setup()
    const value = new Date('2026-08-04T12:00:00Z')
    render(<LastSeenCell value={value} now={now} />)
    await user.hover(screen.getByText('3 days ago'))
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('2026')
  })

  it('carries the absolute timestamp in the accessible name (tooltip is hover-only)', () => {
    render(<LastSeenCell value={new Date('2026-08-04T12:00:00Z')} now={now} />)
    const el = screen.getByText('3 days ago')
    expect(el).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/^3 days ago \(.*2026.*\)$/)
    )
  })
})
