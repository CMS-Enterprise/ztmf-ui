import { render, screen } from '@testing-library/react'
import FipsBaselineStrip from './FipsBaselineStrip'

describe('FipsBaselineStrip', () => {
  it('shows the FIPS badge and the baseline level (Low → Initial)', () => {
    render(<FipsBaselineStrip level="Low" ceiling={2} />)
    expect(screen.getByText('FIPS LOW')).toBeInTheDocument()
    expect(screen.getByText(/Baseline for this system is/)).toBeInTheDocument()
    expect(screen.getByText('Initial')).toBeInTheDocument()
  })

  it('labels a Moderate baseline as Advanced', () => {
    render(<FipsBaselineStrip level="Moderate" ceiling={3} />)
    expect(screen.getByText('FIPS MODERATE')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })
})
