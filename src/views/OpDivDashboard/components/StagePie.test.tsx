import { render, screen } from '@testing-library/react'
import StagePie from './StagePie'
import type { Breakdown } from '../opdivBreakdowns'

const stage: Breakdown = {
  total: 14,
  buckets: [
    { label: 'Optimal', count: 2 },
    { label: 'Advanced', count: 5 },
    { label: 'Initial', count: 4 },
    { label: 'Traditional', count: 2 },
    { label: 'No score', count: 1 },
  ],
}

describe('StagePie', () => {
  it('carries every count as text, not only as a slice', () => {
    // recharts measures to 0x0 under jsdom and renders no SVG, so the legend
    // is not a nicety here - it is the only representation that survives, and
    // the one a screen reader or a colorblind reader relies on either way.
    render(<StagePie stage={stage} />)

    for (const bucket of stage.buckets) {
      const row = screen.getByText(bucket.label).closest('li')
      expect(row).not.toBeNull()
      expect(row).toHaveTextContent(String(bucket.count))
    }
  })

  it('shows each slice as a percentage of the whole', () => {
    render(<StagePie stage={stage} />)

    // 5 of 14 rounds to 36%.
    const advanced = screen.getByText('Advanced').closest('li')
    expect(advanced).toHaveTextContent('36%')
  })

  it('names the total in the middle of the donut', () => {
    render(<StagePie stage={stage} />)

    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('systems')).toBeInTheDocument()
  })

  it('describes the figure for assistive tech and points at the text', () => {
    render(<StagePie stage={stage} />)

    const figure = screen.getByRole('img')
    expect(figure).toHaveAccessibleName(
      expect.stringContaining('14 systems by maturity stage')
    )
    expect(figure).toHaveAccessibleName(
      expect.stringContaining('listed beside the chart')
    )
  })

  it('omits empty buckets rather than drawing zero-width slices', () => {
    render(
      <StagePie
        stage={{
          total: 2,
          buckets: [
            { label: 'Optimal', count: 2 },
            { label: 'Traditional', count: 0 },
          ],
        }}
      />
    )

    expect(screen.getByText('Optimal')).toBeInTheDocument()
    expect(screen.queryByText('Traditional')).not.toBeInTheDocument()
  })

  it('shows the movement column only when something actually moved', () => {
    render(
      <StagePie
        stage={stage}
        movement={{ byTier: { Advanced: 2, Initial: -2 }, n: 173 }}
        priorLabel="FY25 ZTM"
      />
    )

    const advanced = screen.getByText('Advanced').closest('li')
    expect(advanced).toHaveTextContent('+2')
    expect(
      screen.getByText(/Change vs FY25 ZTM, over 173 systems scored in both/i)
    ).toBeInTheDocument()
  })

  it('states that nothing moved rather than rendering a column of dashes', () => {
    // Carried-forward answers leave every system on the tier it already held,
    // so the honest output is one sentence - not an empty column beside a
    // caption promising change, which reads as a broken panel.
    render(
      <StagePie
        stage={stage}
        movement={{ byTier: {}, n: 173 }}
        priorLabel="FY25 ZTM"
      />
    )

    expect(
      screen.getByText(
        /No net tier change vs FY25 ZTM, over 173 systems scored in both/i
      )
    ).toBeInTheDocument()
    const advanced = screen.getByText('Advanced').closest('li')
    expect(advanced).not.toHaveTextContent('—')
  })

  it('says nothing about change when there is no baseline at all', () => {
    render(<StagePie stage={stage} />)

    expect(screen.queryByText(/tier change/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Change vs/i)).not.toBeInTheDocument()
  })

  it('explains an OpDiv with no systems instead of rendering an empty ring', () => {
    render(<StagePie stage={{ total: 0, buckets: [] }} />)

    expect(screen.getByText('No systems in this OpDiv.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
