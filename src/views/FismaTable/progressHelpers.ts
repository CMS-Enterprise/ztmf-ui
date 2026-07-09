import type { ScoreProgress } from '@/types'

/**
 * Sort key for the Data Call Progress column. Ascending sort is the triage
 * order OpDiv Admins want: systems with no update this cycle come first
 * (-1), then partially updated systems by completion fraction, then fully
 * updated ones. Systems with no progress data (fetch failed, or a system
 * not covered by the response) sort last (+2) so unknowns never crowd the
 * top of the triage view.
 * @param {ScoreProgress | undefined} entry - The system's progress row.
 * @returns {number} Sortable rank: -1 not updated, 0..1 fraction, 2 unknown.
 */
export function progressSortValue(entry: ScoreProgress | undefined): number {
  if (!entry) return 2
  if (!entry.updatedsincestart) return -1
  if (entry.questionsexpected <= 0) return 0
  return entry.questionsupdated / entry.questionsexpected
}

/**
 * Tooltip line for the progress cell: when the last update happened, or an
 * explicit "no updates" statement so an empty tooltip never renders.
 * @param {ScoreProgress | undefined} entry - The system's progress row.
 * @returns {string} Human-readable last-activity description.
 */
export function progressTooltip(entry: ScoreProgress | undefined): string {
  if (!entry) return 'No progress data for this data call'
  if (!entry.lastupdatedat) return 'No updates this data call'
  const at = new Date(entry.lastupdatedat)
  if (isNaN(at.getTime())) return 'No updates this data call'
  return `Last updated ${at.toLocaleString()}`
}
