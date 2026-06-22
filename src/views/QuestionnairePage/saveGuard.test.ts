import { shouldPersistResponse, ResponseState } from './saveGuard'

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
