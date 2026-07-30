import type { datacall } from '@/types'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'

/**
 * The data call a dashboard row is displaying. One source of truth shared by
 * the Data Call column, the past-call row styling, and the Pillar Scores
 * modal, so a cell and the modal it opens can never disagree about which call
 * a row is on.
 *
 * Resolution order: the call chosen by most-recently-updated in
 * buildDashboardMaps; else the newest-by-deadline call the system has scores
 * in; else the dashboard's active call as a last resort (e.g. single-call
 * system or maps not yet populated).
 * @param {number} fismasystemid - The row's system id.
 * @param {Record<number, number>} chosenCallMap - System id -> displayed call id.
 * @param {Record<number, number[]>} systemCallMap - System id -> call ids with scores.
 * @param {datacall[]} datacalls - All known data calls.
 * @param {number} activeDataCallId - The dashboard's active call id.
 * @returns {number} The resolved data call id.
 */
export function resolveRowCallId(
  fismasystemid: number,
  chosenCallMap: Record<number, number>,
  systemCallMap: Record<number, number[]>,
  datacalls: datacall[],
  activeDataCallId: number
): number {
  return (
    chosenCallMap[fismasystemid] ??
    sortDatacallsByDeadline(
      (systemCallMap[fismasystemid] ?? [])
        .map((id) => datacalls.find((d) => d.datacallid === id))
        .filter((d): d is datacall => Boolean(d))
    )[0]?.datacallid ??
    activeDataCallId
  )
}
