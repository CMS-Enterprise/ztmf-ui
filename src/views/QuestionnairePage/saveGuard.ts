export interface ResponseState {
  selectQuestionOption: number
  initQuestionChoice: number
  notes: string
  initNotes: string
}

/**
 * Determines whether a questionnaire response should be persisted.
 *
 * Returns true only when the user actually changed the selected answer or the
 * notes AND an answer is currently selected. `-1` is the "no answer" sentinel
 * and must never be written: a score record requires a real functionoptionid,
 * and persisting an unchanged response would re-stamp last_edited_by /
 * last_edited_at, corrupting the audit trail (see issue #412).
 */
export const shouldPersistResponse = (s: ResponseState): boolean => {
  const isDirty =
    (s.selectQuestionOption !== -1 &&
      s.initQuestionChoice !== s.selectQuestionOption) ||
    s.initNotes !== s.notes
  return isDirty && s.selectQuestionOption !== -1
}
