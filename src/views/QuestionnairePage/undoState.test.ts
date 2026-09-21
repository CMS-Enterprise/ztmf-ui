import { canUndoAnswer, undoButtonLabel, undoPreview } from './undoState'
import { canConfirmCarryForward, type CarryForwardState } from './confirmState'

const STATES: CarryForwardState[] = ['unconfirmed', 'updated', 'none']
const BOOLS = [false, true]

describe('canUndoAnswer', () => {
  const base = {
    headUndoable: true,
    state: 'updated' as CarryForwardState,
    dirty: false,
    isReadOnly: false,
    hasScore: true,
    priorReviewBlocked: false,
  }

  it('offers undo for an answer updated this cycle whose head is undoable', () => {
    expect(canUndoAnswer(base)).toBe(true)
  })

  it.each([
    ['the server marks the head not undoable', { headUndoable: false }],
    [
      'the answer was not updated this cycle',
      { state: 'unconfirmed' as const },
    ],
    ['the call is closed or status is unserved', { state: 'none' as const }],
    ['there are unsaved edits', { dirty: true }],
    ['the session is read-only', { isReadOnly: true }],
    ['the question has no answer row', { hasScore: false }],
    ['a prior-response review is pending', { priorReviewBlocked: true }],
  ])('withholds undo when %s', (_why, override) => {
    expect(canUndoAnswer({ ...base, ...override })).toBe(false)
  })
})

describe('undoButtonLabel', () => {
  it.each([
    // No 'undo' case: the server never marks an undo head undoable, so this
    // is never asked to label one.
    ['confirm', 'Undo confirmation'],
    ['update', 'Undo last change'],
    ['create', 'Undo last change'],
    [undefined, 'Undo last change'],
  ])('labels a %s head "%s"', (kind, expected) => {
    expect(undoButtonLabel(kind)).toBe(expected)
  })
})

/**
 * The invariant the strip depends on: Confirm and Undo are two visible paths
 * to writing the same row, so they must never be offered together.
 *
 * This is not incidental. Undoing the first edit of a carried-forward answer
 * returns status to not_started, which re-arms Confirm, while the new head is
 * a kind='undo' revision the server still reports as undoable — so a naive
 * undo predicate would be true at exactly the same moment. canUndoAnswer's
 * `state === 'updated'` clause is what separates them, and this suite is what
 * stops someone relaxing that clause without noticing.
 *
 * Exhaustive rather than illustrative: 3 states x 2^5 flag combinations.
 */
describe('Confirm and Undo are mutually exclusive', () => {
  const cases: {
    state: CarryForwardState
    headUndoable: boolean
    dirty: boolean
    isReadOnly: boolean
    hasScore: boolean
    priorReviewBlocked: boolean
  }[] = []

  for (const state of STATES)
    for (const headUndoable of BOOLS)
      for (const dirty of BOOLS)
        for (const isReadOnly of BOOLS)
          for (const hasScore of BOOLS)
            for (const priorReviewBlocked of BOOLS)
              cases.push({
                state,
                headUndoable,
                dirty,
                isReadOnly,
                hasScore,
                priorReviewBlocked,
              })

  it('covers every state and flag combination', () => {
    expect(cases).toHaveLength(STATES.length * 2 ** 5)
  })

  it.each(cases)('never both true for %j', (c) => {
    const confirm = canConfirmCarryForward({
      state: c.state,
      dirty: c.dirty,
      isReadOnly: c.isReadOnly,
      priorReviewBlocked: c.priorReviewBlocked,
    })
    const undo = canUndoAnswer(c)
    expect(confirm && undo).toBe(false)
  })

  it('offers exactly one of them on the two states that matter', () => {
    const settled = {
      headUndoable: true,
      dirty: false,
      isReadOnly: false,
      hasScore: true,
      priorReviewBlocked: false,
    }
    // A carried-forward answer awaiting review: Confirm only.
    expect(canConfirmCarryForward({ ...settled, state: 'unconfirmed' })).toBe(
      true
    )
    expect(canUndoAnswer({ ...settled, state: 'unconfirmed' })).toBe(false)

    // The same answer once edited this cycle: Undo only.
    expect(canConfirmCarryForward({ ...settled, state: 'updated' })).toBe(false)
    expect(canUndoAnswer({ ...settled, state: 'updated' })).toBe(true)
  })
})

describe('undoPreview', () => {
  it('names the answer, its justification and when it was saved', () => {
    expect(
      undoPreview({
        restoresOptionName: 'Traditional',
        restoresNotes: true,
        savedAt: '2026-03-03T00:00:00Z',
      })
    ).toMatch(
      /^Restores the answer "Traditional" and its justification, saved .+\.$/
    )
  })

  it('omits the justification clause when the restored side had no notes', () => {
    const preview = undoPreview({
      restoresOptionName: 'Advanced',
      restoresNotes: false,
      savedAt: '2026-03-03T00:00:00Z',
    })
    expect(preview).toContain('Restores the answer "Advanced"')
    expect(preview).not.toContain('justification')
  })

  it('drops the date rather than rendering an invalid one', () => {
    expect(
      undoPreview({
        restoresOptionName: 'Advanced',
        restoresNotes: false,
        savedAt: 'not-a-date',
      })
    ).toBe('Restores the answer "Advanced".')
  })

  // The caller omits aria-describedby entirely rather than pointing at an
  // empty element, which a screen reader would announce as nothing.
  it('returns undefined when the restored option cannot be named', () => {
    expect(undoPreview({ restoresNotes: true })).toBeUndefined()
  })
})
