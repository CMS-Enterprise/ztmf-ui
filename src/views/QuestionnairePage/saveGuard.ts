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
 * True when the user changed the radio answer but has not supplied a
 * substantial, non-empty notes explanation. Drives the inline error state
 * under the notes field and disables the Next button until the user
 * updates the notes.
 *
 * The rule fires only when the user actually flipped an already-answered
 * response — first-time answers on a fresh data call short-circuit false
 * (`initQuestionChoice === -1`) so a new data call does not force a note
 * on every question. Clearing an existing note also fires the rule: an
 * explanation must ride along with the changed answer, so wiping the
 * notes field cannot slip past the guard even though it is technically a
 * "substantial change" from the prior text.
 */
export const needsNotesUpdateForChoiceChange = (s: ResponseState): boolean => {
  if (s.selectQuestionOption === -1) return false
  // No prior answer: the "must update notes" rule does not apply on a
  // first-time response. Without this short-circuit, every question on a
  // freshly-loaded data call would be forced to carry a note.
  if (s.initQuestionChoice === -1) return false
  if (s.selectQuestionOption === s.initQuestionChoice) return false
  // Choice changed on a previously-answered question. Require the notes
  // field to hold a non-empty explanation: clearing the notes counts as a
  // violation even though a wipe reads as a "substantial change" by
  // itself.
  if (s.notes.trim().length === 0) return true
  return !isSubstantialNotesChange(s.notes, s.initNotes)
}
