import type { ScoreProgress } from '@/types'

/**
 * True when the system has no questionnaire this data call (no functions apply
 * to its environment). The backend intentionally returns these systems as
 * `0/0`; the frontend owns the display decision, and they are not actionable
 * triage items — there is nothing to nudge.
 * @param {ScoreProgress | undefined} entry - The system's progress row.
 * @returns {boolean} True when the system has zero applicable questions.
 */
export function hasNoQuestionnaire(entry: ScoreProgress | undefined): boolean {
  return !!entry && entry.questionsexpected <= 0
}

/**
 * Sort key for the Data Call Progress column. Ascending sort is the triage
 * order OpDiv Admins want, most-urgent first:
 *
 *   -1  not updated but HAS a questionnaire  (needs a nudge — top of the list)
 *   0..1 partially updated, by completion fraction
 *   1   fully updated (a complete system lands at exactly 1)
 *   1.5 no questionnaire applies (0/0 — nothing to do, not a laggard)
 *   2   no progress data (fetch failed or system not covered — unknown, last)
 *
 * The 0/0 (no-questionnaire) case is classified BEFORE the not-updated branch:
 * such a system is technically "not updated," but it has nothing to update, so
 * it must not sort to the triage top alongside genuine laggards.
 *
 * For a PAST call the "-1 needs a nudge" ranking is wrong - a closed call has no
 * updates to chase, so ranking by questionsupdated would sort every historical
 * row to the laggard top, contradicting its own Complete/Incomplete chip. Past
 * calls are ranked by completion (answered/total) instead, never -1. Prefer
 * QuestionsAnswered (ztmf#437); without it, a past-call row with progress is
 * treated as complete (1) so it never ranks as urgent.
 * @param {ScoreProgress | undefined} entry - The system's progress row.
 * @param {boolean} [isCurrentCall=true] - Whether the row's displayed call is
 *   the current/active one. Past calls sort by completion, not updates.
 * @returns {number} Sortable rank (see above).
 */
export function progressSortValue(
  entry: ScoreProgress | undefined,
  isCurrentCall: boolean = true
): number {
  if (!entry) return 2
  if (entry.questionsexpected <= 0) return 1.5
  if (!isCurrentCall) {
    const answered = entry.questionsanswered
    if (answered == null) return 1
    return Math.min(Math.max(answered, 0) / entry.questionsexpected, 1)
  }
  if (entry.questionsupdated <= 0) return -1
  return entry.questionsupdated / entry.questionsexpected
}

/**
 * Tooltip line for the progress cell: the last-update time when there is one,
 * otherwise a state description that never contradicts the chip (an "Updated"
 * system with an unusable timestamp reads "time unavailable," not "no updates").
 * @param {ScoreProgress | undefined} entry - The system's progress row.
 * @param {object} [opts] - Display context.
 * @param {boolean} [opts.completed] - True when the cell shows a past-call
 *   "Complete" chip (ztmf#537). The current-cycle fallbacks below describe
 *   this-cycle activity, which is meaningless for a closed call, so a completed
 *   cell without a usable timestamp reads "Data call complete" instead.
 * @returns {string} Human-readable description of the cell's state.
 */
export function progressTooltip(
  entry: ScoreProgress | undefined,
  opts: { completed?: boolean } = {}
): string {
  if (!entry) return 'No progress data for this data call'
  if (entry.lastupdatedat) {
    const at = new Date(entry.lastupdatedat)
    if (!isNaN(at.getTime())) return `Last updated ${at.toLocaleString()}`
  }
  // No usable timestamp: describe the state without contradicting the chip.
  if (opts.completed) return 'Data call complete'
  if (hasNoQuestionnaire(entry))
    return 'No questionnaire applies to this system'
  if (entry.questionsupdated > 0) return 'Updated (time unavailable)'
  return 'No updates this data call'
}
