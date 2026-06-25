import { render, screen } from '@testing-library/react'
import ScoreDisplay from './ScoreDisplay'

describe('ScoreDisplay', () => {
  it('renders the score to two decimals and the tier name', () => {
    render(<ScoreDisplay score={4} tier="Optimal" />)
    expect(screen.getByText('4.00')).toBeInTheDocument()
    expect(screen.getByText('Optimal')).toBeInTheDocument()
  })

  it('renders a non-integer score', () => {
    render(<ScoreDisplay score={3.21} tier="Advanced" />)
    expect(screen.getByText('3.21')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('shows a placeholder and Not Assessed when there is no score', () => {
    render(<ScoreDisplay />)
    expect(screen.getByText('--')).toBeInTheDocument()
    expect(screen.getByText('Not Assessed')).toBeInTheDocument()
  })

  it('can hide the tier label', () => {
    render(<ScoreDisplay score={2.05} tier="Initial" showTier={false} />)
    expect(screen.getByText('2.05')).toBeInTheDocument()
    expect(screen.queryByText('Initial')).not.toBeInTheDocument()
  })
})
