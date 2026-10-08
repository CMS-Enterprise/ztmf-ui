import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChartCard from './ChartCard'
import { jumpToPanel } from './jumpToPanel'

describe('ChartCard', () => {
  it('is a region named by its heading', () => {
    render(
      <ChartCard eyebrow="Not started" id="not-started">
        body
      </ChartCard>
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Not started' })
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Not started' })).toHaveAttribute(
      'id',
      'not-started'
    )
  })

  it('lands a tile jump on the named region', () => {
    render(
      <ChartCard eyebrow="Risk" id="risk">
        body
      </ChartCard>
    )
    const region = screen.getByRole('region', { name: 'Risk' })
    region.scrollIntoView = jest.fn()
    jumpToPanel('risk')
    expect(region).toHaveFocus()
  })

  it('keeps the info button named, with the explanation as its description', async () => {
    // Without describeChild the button's aria-label wins and the info is never announced.
    render(
      <ChartCard eyebrow="Coverage" info="How many systems answered.">
        body
      </ChartCard>
    )
    const button = screen.getByRole('button', { name: 'About Coverage' })
    await userEvent.tab()
    expect(button).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()
    expect(button).toHaveAccessibleDescription('How many systems answered.')
  })
})
