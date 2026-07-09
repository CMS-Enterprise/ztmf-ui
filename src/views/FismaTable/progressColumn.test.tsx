import { render, screen } from '@testing-library/react'
import type { ScoreProgress } from '@/types'
import { ProgressCell } from './progressColumn'
import { progressSortValue, progressTooltip } from './progressHelpers'

const updatedEntry: ScoreProgress = {
  fismasystemid: 1,
  questionsexpected: 41,
  questionsupdated: 12,
  lastupdatedat: '2026-07-01T15:30:00Z',
  updatedsincestart: true,
}

const untouchedEntry: ScoreProgress = {
  fismasystemid: 2,
  questionsexpected: 41,
  questionsupdated: 0,
  lastupdatedat: null,
  updatedsincestart: false,
}

describe('progressSortValue', () => {
  // Ascending sort is the OpDiv Admin triage order: not-updated systems
  // first, then partial progress by fraction, complete last, and systems
  // with no progress data at the very end.
  it('ranks not-updated before any updated system', () => {
    expect(progressSortValue(untouchedEntry)).toBeLessThan(
      progressSortValue(updatedEntry)
    )
  })

  it('ranks partial progress below complete', () => {
    const complete: ScoreProgress = {
      ...updatedEntry,
      questionsupdated: 41,
    }
    expect(progressSortValue(updatedEntry)).toBeLessThan(
      progressSortValue(complete)
    )
  })

  it('ranks missing progress data last', () => {
    expect(progressSortValue(undefined)).toBeGreaterThan(
      progressSortValue({ ...updatedEntry, questionsupdated: 41 })
    )
  })

  it('does not divide by zero when a system has no applicable questions', () => {
    const empty: ScoreProgress = {
      fismasystemid: 3,
      questionsexpected: 0,
      questionsupdated: 0,
      updatedsincestart: true,
    }
    expect(progressSortValue(empty)).toBe(0)
  })
})

describe('progressTooltip', () => {
  it('describes the last update time when present', () => {
    expect(progressTooltip(updatedEntry)).toMatch(/^Last updated /)
  })

  it('states no updates for an untouched system', () => {
    expect(progressTooltip(untouchedEntry)).toBe('No updates this data call')
  })

  it('states no data when the entry is missing', () => {
    expect(progressTooltip(undefined)).toBe(
      'No progress data for this data call'
    )
  })

  it('falls back to no-updates on an unparseable timestamp', () => {
    expect(
      progressTooltip({ ...updatedEntry, lastupdatedat: 'not-a-date' })
    ).toBe('No updates this data call')
  })
})

describe('ProgressCell', () => {
  it('renders the fraction and an Updated chip for an edited system', () => {
    render(<ProgressCell entry={updatedEntry} />)
    expect(screen.getByText('12/41')).toBeInTheDocument()
    expect(screen.getByText('Updated')).toBeInTheDocument()
  })

  it('renders the fraction and a Not updated chip for a carried-over system', () => {
    // A pre-populated questionnaire has answers but no edits this cycle -
    // the whole point of ztmf#299 is that this renders as NOT updated.
    render(<ProgressCell entry={untouchedEntry} />)
    expect(screen.getByText('0/41')).toBeInTheDocument()
    expect(screen.getByText('Not updated')).toBeInTheDocument()
  })

  it('renders an em-dash when progress data is missing', () => {
    render(<ProgressCell entry={undefined} />)
    expect(screen.getByLabelText('No progress data')).toBeInTheDocument()
  })
})
