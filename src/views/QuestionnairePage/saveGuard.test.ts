import {
  shouldPersistResponse,
  isSubstantialNotesChange,
  needsNotesUpdateForChoiceChange,
  ResponseState,
} from './saveGuard'

const base: ResponseState = {
  selectQuestionOption: 5,
  initQuestionChoice: 5,
  notes: 'hello',
  initNotes: 'hello',
}

describe('shouldPersistResponse', () => {
  it('returns false when neither answer nor notes changed (no re-stamp on Next)', () => {
    expect(shouldPersistResponse(base)).toBe(false)
  })

  it('returns true when the answer changed', () => {
    expect(shouldPersistResponse({ ...base, selectQuestionOption: 7 })).toBe(
      true
    )
  })

  it('returns true when the notes changed and an answer is selected', () => {
    expect(shouldPersistResponse({ ...base, notes: 'edited' })).toBe(true)
  })

  it('returns false for an unanswered question with unchanged notes', () => {
    expect(
      shouldPersistResponse({
        selectQuestionOption: -1,
        initQuestionChoice: -1,
        notes: '',
        initNotes: '',
      })
    ).toBe(false)
  })

  it('returns false when notes were typed but no answer is selected (no functionoptionid: -1 POST)', () => {
    expect(
      shouldPersistResponse({
        selectQuestionOption: -1,
        initQuestionChoice: -1,
        notes: 'typed something',
        initNotes: '',
      })
    ).toBe(false)
  })
})

describe('isSubstantialNotesChange', () => {
  it('returns false when strings are identical', () => {
    expect(isSubstantialNotesChange('hello', 'hello')).toBe(false)
  })

  it('returns false when only trailing whitespace was added', () => {
    expect(isSubstantialNotesChange('hello ', 'hello')).toBe(false)
    expect(isSubstantialNotesChange('hello\n', 'hello')).toBe(false)
  })

  it('returns false when only leading whitespace was added', () => {
    expect(isSubstantialNotesChange(' hello', 'hello')).toBe(false)
  })

  it('returns true when there is an internal edit', () => {
    expect(isSubstantialNotesChange('hello there', 'hello')).toBe(true)
  })

  it('returns false when both are empty', () => {
    expect(isSubstantialNotesChange('', '')).toBe(false)
  })

  it('returns true when text is added from empty', () => {
    expect(isSubstantialNotesChange('new content', '')).toBe(true)
  })
})

describe('needsNotesUpdateForChoiceChange', () => {
  const base: ResponseState = {
    selectQuestionOption: 5,
    initQuestionChoice: 5,
    notes: 'existing notes',
    initNotes: 'existing notes',
  }

  it('returns false when no answer is selected (rule does not apply)', () => {
    expect(
      needsNotesUpdateForChoiceChange({
        selectQuestionOption: -1,
        initQuestionChoice: -1,
        notes: '',
        initNotes: '',
      })
    ).toBe(false)
  })

  it('returns false when the choice has not changed (regardless of notes)', () => {
    expect(needsNotesUpdateForChoiceChange(base)).toBe(false)
    expect(
      needsNotesUpdateForChoiceChange({ ...base, notes: 'edited notes' })
    ).toBe(false)
  })

  it('returns true when the choice changed and the notes are unchanged', () => {
    expect(
      needsNotesUpdateForChoiceChange({ ...base, selectQuestionOption: 7 })
    ).toBe(true)
  })

  it('returns true when the choice changed and the notes differ only by trailing whitespace', () => {
    expect(
      needsNotesUpdateForChoiceChange({
        ...base,
        selectQuestionOption: 7,
        notes: 'existing notes ',
      })
    ).toBe(true)
  })

  it('returns true when the choice changed and the notes differ only by leading whitespace', () => {
    expect(
      needsNotesUpdateForChoiceChange({
        ...base,
        selectQuestionOption: 7,
        notes: ' existing notes',
      })
    ).toBe(true)
  })

  it('returns false when the choice changed and the notes were substantively edited', () => {
    expect(
      needsNotesUpdateForChoiceChange({
        ...base,
        selectQuestionOption: 7,
        notes: 'reason for tier change',
      })
    ).toBe(false)
  })

  it('returns false when the choice changed from an empty-notes baseline and real text was typed', () => {
    expect(
      needsNotesUpdateForChoiceChange({
        selectQuestionOption: 7,
        initQuestionChoice: 5,
        notes: 'first-time explanation',
        initNotes: '',
      })
    ).toBe(false)
  })

  it('returns false on a first-time answer (no prior choice), regardless of notes', () => {
    // On any new data call every question starts at initQuestionChoice === -1.
    // The "must update notes" rule only applies once a response exists, so
    // first-time answers must never fire the guard.
    expect(
      needsNotesUpdateForChoiceChange({
        selectQuestionOption: 7,
        initQuestionChoice: -1,
        notes: '',
        initNotes: '',
      })
    ).toBe(false)
    expect(
      needsNotesUpdateForChoiceChange({
        selectQuestionOption: 7,
        initQuestionChoice: -1,
        notes: 'first-time explanation',
        initNotes: '',
      })
    ).toBe(false)
  })

  it('returns true when the choice changed and the notes were cleared', () => {
    // Wiping the notes counts as a "substantial change" from the prior text,
    // but the intent is that an explanation must ride along with the changed
    // answer — an empty notes field cannot slip past the guard.
    expect(
      needsNotesUpdateForChoiceChange({
        selectQuestionOption: 7,
        initQuestionChoice: 5,
        notes: '',
        initNotes: 'old reason',
      })
    ).toBe(true)
    // Whitespace-only after clearing counts the same.
    expect(
      needsNotesUpdateForChoiceChange({
        selectQuestionOption: 7,
        initQuestionChoice: 5,
        notes: '   \n',
        initNotes: 'old reason',
      })
    ).toBe(true)
  })

  it('returns true when the choice changed and the notes were empty on both sides', () => {
    // Existing answer with no notes recorded; user flips the choice and does
    // not add any notes. The guard must fire so the user is forced to
    // explain the change.
    expect(
      needsNotesUpdateForChoiceChange({
        selectQuestionOption: 7,
        initQuestionChoice: 5,
        notes: '',
        initNotes: '',
      })
    ).toBe(true)
  })
})
