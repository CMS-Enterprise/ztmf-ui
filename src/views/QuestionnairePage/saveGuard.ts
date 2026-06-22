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
  // No answer selected: never persist. `-1` is the sentinel and the backend
  // cannot store a score without a real functionoptionid.
  if (s.selectQuestionOption === -1) return false
  return (
    s.selectQuestionOption !== s.initQuestionChoice || s.notes !== s.initNotes
  )
}
