import { render, screen } from '@testing-library/react'
import type { SystemScoreEntry } from '@/types'
import { ScoreCell } from './scoreColumn'
import { scoreSortValue } from './scoreHelpers'

describe('scoreSortValue', () => {
  it('sorts a never-assessed system below a genuine zero', () => {
    // The whole point of the column fix: "no score row" and "assessed at 0.00"
    // must not collapse to the same value.
    expect(scoreSortValue(undefined)).toBeLessThan(scoreSortValue({ score: 0 }))
  })

  it('returns the numeric score for an assessed system', () => {
    expect(scoreSortValue({ score: 3.5 })).toBe(3.5)
    expect(scoreSortValue({ score: 0 })).toBe(0)
  })
})

describe('ScoreCell', () => {
  it('reads "Not scored" for a system with no score row', () => {
    render(<ScoreCell entry={undefined} />)
    expect(screen.getByText('Not scored')).toBeInTheDocument()
    // Never the shared 0.00 that hid these systems.
    expect(screen.queryByText('0.00')).not.toBeInTheDocument()
  })

  it('renders a real 0.00 for a system genuinely assessed at zero', () => {
    render(<ScoreCell entry={{ score: 0 }} />)
    expect(screen.getByText('0.00')).toBeInTheDocument()
    expect(screen.queryByText('Not scored')).not.toBeInTheDocument()
  })

  it('renders the two-decimal score for an assessed system', () => {
    const entry: SystemScoreEntry = { score: 3.5 }
    render(<ScoreCell entry={entry} />)
    expect(screen.getByText('3.50')).toBeInTheDocument()
  })
})
