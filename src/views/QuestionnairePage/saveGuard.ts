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

/**
 * True when the notes text differs beyond leading/trailing whitespace.
 * A trailing space or newline does not count as a real edit. If we later
 * need to reject runs of internal whitespace or short edits, this is the
 * one place to tighten - callers see a boolean either way.
 */
export const isSubstantialNotesChange = (
  current: string,
  initial: string
): boolean => current.trim() !== initial.trim()

/**
 * True when the user changed the radio answer but has not substantially
 * updated the notes. Drives the inline error state under the notes field
 * and disables the Next button until the user updates the notes.
 *
 * Returns false for unanswered questions (the `-1` sentinel) - the "must
 * update notes" rule only applies when the user actually flipped an
 * already-answered response.
 */
export const needsNotesUpdateForChoiceChange = (s: ResponseState): boolean => {
  if (s.selectQuestionOption === -1) return false
  if (s.selectQuestionOption === s.initQuestionChoice) return false
  return !isSubstantialNotesChange(s.notes, s.initNotes)
}
