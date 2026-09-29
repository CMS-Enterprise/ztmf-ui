import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KpiTile from './KpiTile'

describe('KpiTile', () => {
  it('explains itself on hover without becoming its own name', () => {
    // A bare MUI Tooltip becomes the child's aria-label, which would replace
    // "Declining scores 4" with a paragraph as the tile's accessible name.
    render(
      <KpiTile
        label="Declining scores"
        value={4}
        hint="of 173 scored in both"
        jumpToId="somewhere"
        info="Counted over the systems scored in both calls."
      />
    )
    const tile = screen.getByRole('button', { name: /^Declining scores/ })
    expect(tile).toHaveTextContent('4')
    expect(tile).not.toHaveAttribute('aria-label')
  })

  it('shows the explanation on keyboard focus, not only on hover', async () => {
    // A hover-only explanation is no explanation for a keyboard reader.
    render(<KpiTile label="Unscored" value="79/252" info="Never enrolled." />)
    await userEvent.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Never enrolled.'
    )
  })

  it('stays out of the tab order when it has nothing to explain', () => {
    render(<KpiTile label="Highest score" value="4.09" hint="CATS" />)
    expect(screen.getByText('Highest score').closest('[tabindex]')).toBeNull()
  })

  it('carries an icon as well as a color for a toned tile', () => {
    // Severity must survive a monochrome print and a color-blind reader, so
    // the rail is never the only channel.
    const { container } = render(
      <KpiTile label="Not started" value="252/252" tone="danger" />
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
