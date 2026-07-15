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

  it('ranks a no-questionnaire system after complete but before missing data', () => {
    // A 0/0 system is technically "not updated" but has nothing to update, so
    // it must sort with the done pile, not the triage top - and ahead of a
    // genuine no-data row.
    const empty: ScoreProgress = {
      fismasystemid: 3,
      questionsexpected: 0,
      questionsupdated: 0,
      updatedsincestart: false,
    }
    const complete: ScoreProgress = { ...updatedEntry, questionsupdated: 41 }
    expect(progressSortValue(empty)).toBeGreaterThan(
      progressSortValue(complete)
    )
    expect(progressSortValue(empty)).toBeLessThan(progressSortValue(undefined))
  })

  it('does not sort a no-questionnaire system to the triage top', () => {
    // Regression: the guard for 0 expected must be checked BEFORE the
    // not-updated branch, or a 0/0 system lands at the very top next to real
    // laggards.
    const empty: ScoreProgress = {
      fismasystemid: 3,
      questionsexpected: 0,
      questionsupdated: 0,
      updatedsincestart: false,
    }
    expect(progressSortValue(empty)).toBeGreaterThan(
      progressSortValue(untouchedEntry)
    )
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

  it('does not contradict the chip on an unparseable timestamp', () => {
    // An updated system with a bad timestamp must not read "No updates" - that
    // would disagree with its green Updated chip. It reports the state instead.
    expect(
      progressTooltip({ ...updatedEntry, lastupdatedat: 'not-a-date' })
    ).toBe('Updated (time unavailable)')
  })

  it('describes a no-questionnaire system', () => {
    const empty: ScoreProgress = {
      fismasystemid: 3,
      questionsexpected: 0,
      questionsupdated: 0,
      updatedsincestart: false,
    }
    expect(progressTooltip(empty)).toBe(
      'No questionnaire applies to this system'
    )
  })

  it('reads "complete" for a past-call cell without a usable timestamp', () => {
    // A completed past call has 0 updates this cycle, so the current-cycle
    // fallback would wrongly say "No updates" - the completed flag must win.
    expect(progressTooltip(untouchedEntry, { completed: true })).toBe(
      'Data call complete'
    )
  })

  it('still prefers a real last-update time over the completed fallback', () => {
    expect(progressTooltip(updatedEntry, { completed: true })).toMatch(
      /^Last updated /
    )
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

  it('renders a neutral N/A chip when no questionnaire applies', () => {
    // A 0/0 system is not a laggard - it must not wear the orange "Not
    // updated" chip, and it shows no misleading fraction.
    const empty: ScoreProgress = {
      fismasystemid: 3,
      questionsexpected: 0,
      questionsupdated: 0,
      updatedsincestart: false,
    }
    render(<ProgressCell entry={empty} />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
    expect(screen.queryByText('0/0')).not.toBeInTheDocument()
  })

  it('renders a neutral Complete chip for a scored past-call system', () => {
    // ztmf#537: a past call reads 0 updates this cycle for everyone. A system
    // with a score for that call was completed - show a neutral Complete chip,
    // never the orange "0/40 Not updated" laggard chip.
    render(
      <ProgressCell
        entry={untouchedEntry}
        isCurrentCall={false}
        hasScore={true}
      />
    )
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
    expect(screen.queryByText('0/41')).not.toBeInTheDocument()
  })

  it('keeps the current-cycle chip for the same entry on the active call', () => {
    // Same untouched entry, but on the current call it is a genuine laggard.
    render(
      <ProgressCell
        entry={untouchedEntry}
        isCurrentCall={true}
        hasScore={true}
      />
    )
    expect(screen.getByText('0/41')).toBeInTheDocument()
    expect(screen.getByText('Not updated')).toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
  })

  it('renders an em-dash for a past-call system with no score', () => {
    // Defensive: a past-call row must never show the orange laggard chip even
    // without a score to prove completion.
    render(
      <ProgressCell
        entry={untouchedEntry}
        isCurrentCall={false}
        hasScore={false}
      />
    )
    expect(screen.getByLabelText('No progress data')).toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
  })
})
