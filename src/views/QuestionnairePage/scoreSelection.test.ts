import {
  deriveScoreSelection,
  shouldReseedAnswer,
  ScoreMap,
} from './scoreSelection'

describe('deriveScoreSelection', () => {
  it('returns the "no answer" sentinel when no option is in the scores map', () => {
    const scores: ScoreMap = {}
    expect(deriveScoreSelection([10, 11, 12], scores)).toEqual({
      funcOptId: 0,
      choice: -1,
      notes: '',
      scoreid: 0,
    })
  })

  it('derives the answered option, its notes and scoreid', () => {
    const scores: ScoreMap = { 11: { notes: 'because', scoreid: 42 } }
    expect(deriveScoreSelection([10, 11, 12], scores)).toEqual({
      funcOptId: 11,
      choice: 11,
      notes: 'because',
      scoreid: 42,
    })
  })

  it('picks the first matching option when several are present', () => {
    const scores: ScoreMap = {
      12: { notes: 'b', scoreid: 2 },
      10: { notes: 'a', scoreid: 1 },
    }
    // Iteration order follows the option list, not the map.
    expect(deriveScoreSelection([10, 11, 12], scores).funcOptId).toBe(10)
  })

  it('treats an empty-notes answer as answered (scoreid drives PUT vs POST)', () => {
    const scores: ScoreMap = { 7: { notes: '', scoreid: 99 } }
    expect(deriveScoreSelection([7], scores)).toEqual({
      funcOptId: 7,
      choice: 7,
      notes: '',
      scoreid: 99,
    })
  })

  it('returns the sentinel for an empty option list', () => {
    expect(deriveScoreSelection([], { 1: { notes: 'x', scoreid: 1 } })).toEqual(
      {
        funcOptId: 0,
        choice: -1,
        notes: '',
        scoreid: 0,
      }
    )
  })
})

describe('shouldReseedAnswer', () => {
  const clean = {
    hasQuestion: true,
    loadingQuestion: false,
    hasUnsavedEdits: false,
    draftRestored: false,
  }

  it('allows a re-seed when idle on a question with no unsaved edits', () => {
    expect(shouldReseedAnswer(clean)).toBe(true)
  })

  it('blocks while the question is loading (fetchOptions owns seeding)', () => {
    expect(shouldReseedAnswer({ ...clean, loadingQuestion: true })).toBe(false)
  })

  it('blocks when there is no active question', () => {
    expect(shouldReseedAnswer({ ...clean, hasQuestion: false })).toBe(false)
  })

  it('blocks when the user has unsaved edits (never clobber them)', () => {
    expect(shouldReseedAnswer({ ...clean, hasUnsavedEdits: true })).toBe(false)
  })

  it('blocks when a draft was restored (the draft owns the fields)', () => {
    expect(shouldReseedAnswer({ ...clean, draftRestored: true })).toBe(false)
  })
})
