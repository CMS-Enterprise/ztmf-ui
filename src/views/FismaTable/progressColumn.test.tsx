import { render, screen } from '@testing-library/react'
import type { ScoreProgress } from '@/types'
import { ProgressCell } from './progressColumn'
import { progressSortValue, progressTooltip } from './progressHelpers'

const updatedEntry: ScoreProgress = {
  fismasystemid: 1,
  questionsexpected: 41,
  questionsanswered: 12,
  questionsupdated: 12,
  lastupdatedat: '2026-07-01T15:30:00Z',
  updatedsincestart: true,
}

const untouchedEntry: ScoreProgress = {
  fismasystemid: 2,
  questionsexpected: 41,
  questionsanswered: 0,
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
      questionsanswered: 0,
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
      questionsanswered: 0,
      questionsupdated: 0,
      updatedsincestart: false,
    }
    expect(progressSortValue(empty)).toBeGreaterThan(
      progressSortValue(untouchedEntry)
    )
  })

  it('does not sort a past-call row to the laggard top', () => {
    // ztmf-ui#542: on a past call, questionsupdated is 0 for everyone, so the
    // current-call -1 "needs a nudge" rank would wrongly sort every historical
    // row above real current-call laggards. Past calls rank by completion.
    const pastComplete: ScoreProgress = {
      ...untouchedEntry,
      questionsanswered: 41,
    }
    const pastPartial: ScoreProgress = {
      ...untouchedEntry,
      questionsanswered: 10,
    }
    // Not at the -1 laggard rank...
    expect(progressSortValue(pastComplete, false)).toBeGreaterThan(
      progressSortValue(untouchedEntry, true)
    )
    // ...and a less-complete past call sorts ahead of a more-complete one.
    expect(progressSortValue(pastPartial, false)).toBeLessThan(
      progressSortValue(pastComplete, false)
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
      questionsanswered: 0,
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

  it('renders the fraction and a laggard chip for an unstarted system', () => {
    // No answers and no edits this cycle, so the cell shows the honest
    // fraction alongside the warning chip. The fixture carries zero answers,
    // which is the "Not started" half of the wording split; the carried-answers
    // half is covered below.
    render(<ProgressCell entry={untouchedEntry} />)
    expect(screen.getByText('0/41')).toBeInTheDocument()
    expect(screen.getByText('Not started')).toBeInTheDocument()
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
      questionsanswered: 0,
      questionsupdated: 0,
      updatedsincestart: false,
    }
    render(<ProgressCell entry={empty} />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
    expect(screen.queryByText('0/0')).not.toBeInTheDocument()
  })

  it('renders 0/total + Incomplete for a fully-unanswered past call', () => {
    // ztmf#537 kept a past call off the orange laggard chip; ztmf-ui#578
    // retires the score-presence proxy, so a past call nobody answered reads
    // an honest 0/41 with the neutral-warning Incomplete chip instead.
    render(<ProgressCell entry={untouchedEntry} isCurrentCall={false} />)
    expect(screen.getByText('0/41')).toBeInTheDocument()
    expect(screen.getByText('Incomplete')).toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
  })

  it('keeps the current-cycle chip for the same entry on the active call', () => {
    // Same untouched entry, but on the current call it is a genuine laggard,
    // so it wears the warning chip rather than the past-call Incomplete one.
    render(<ProgressCell entry={untouchedEntry} isCurrentCall={true} />)
    expect(screen.getByText('0/41')).toBeInTheDocument()
    expect(screen.getByText('Not started')).toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
    expect(screen.queryByText('Incomplete')).not.toBeInTheDocument()
  })

  it('renders Complete for a fully-answered past call even with zero updates', () => {
    // ztmf#437: completion is answered/total, not updated/total. An imported or
    // carried-over call is fully answered (answered == expected) but never
    // "updated this cycle" - it must read Complete, not Incomplete.
    render(
      <ProgressCell
        entry={{ ...untouchedEntry, questionsanswered: 41 }}
        isCurrentCall={false}
      />
    )
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.queryByText('Incomplete')).not.toBeInTheDocument()
  })

  it('renders answered/total + Incomplete for a partially-answered past call', () => {
    // Jono's blocker (ztmf-ui#542): a past call that was only 10/41 answered
    // must NOT read Complete just because it has a score. QuestionsAnswered
    // exposes the truth - show the honest fraction and an Incomplete chip.
    render(
      <ProgressCell
        entry={{ ...untouchedEntry, questionsanswered: 10 }}
        isCurrentCall={false}
      />
    )
    expect(screen.getByText('10/41')).toBeInTheDocument()
    expect(screen.getByText('Incomplete')).toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
  })

  // --- Carried-forward wording on the current call ---

  it('reads Awaiting confirmation for a current-call system with carried answers and zero updates', () => {
    // The answers exist (carried forward) but none count as updated —
    // "0/41 Not updated" read as data loss; the chip says the actual state.
    render(
      <ProgressCell
        entry={{ ...untouchedEntry, questionsanswered: 41 }}
        isCurrentCall={true}
      />
    )
    expect(screen.getByText('0/41')).toBeInTheDocument()
    expect(screen.getByText('Awaiting confirmation')).toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
  })

  it('reads Not started for a current-call system with no answers at all', () => {
    render(
      <ProgressCell
        entry={{ ...untouchedEntry, questionsanswered: 0 }}
        isCurrentCall={true}
      />
    )
    expect(screen.getByText('0/41')).toBeInTheDocument()
    expect(screen.getByText('Not started')).toBeInTheDocument()
    expect(screen.queryByText('Not updated')).not.toBeInTheDocument()
  })

  it('keeps the legacy Not updated wording when questionsanswered is absent', () => {
    // The field is now required on ScoreProgress, so absence can no longer be
    // expressed through the type. It remains reachable at runtime against a
    // backend that predates the field, which is exactly what the cell's
    // fallback guards, so the cast is deliberate: it exercises the runtime
    // path the type alone can no longer describe.
    const withoutAnswered = {
      ...untouchedEntry,
      questionsanswered: undefined,
    } as unknown as ScoreProgress
    render(<ProgressCell entry={withoutAnswered} isCurrentCall={true} />)
    expect(screen.getByText('Not updated')).toBeInTheDocument()
  })

  it('describes the carried-forward state in the tooltip', () => {
    expect(progressTooltip({ ...untouchedEntry, questionsanswered: 41 })).toBe(
      'Answers carried forward from a previous data call — not yet confirmed'
    )
    // No answers at all keeps the plain no-updates line.
    expect(progressTooltip({ ...untouchedEntry, questionsanswered: 0 })).toBe(
      'No updates this data call'
    )
  })
})
