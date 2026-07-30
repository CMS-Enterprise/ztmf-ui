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
/**
 * Sort comparator for the Data Call column. Cell values are call NAMES (so
 * the quick filter can match them), but names do not sort chronologically
 * ("FY2025 Q3" string-sorts near "FY25 ZTM" by accident only), so ordering
 * goes through each call's deadline. A name with no known deadline sinks to
 * the oldest end rather than interleaving (mirrors sortDatacallsByDeadline's
 * bad-value handling). Duplicate call names collapse to one deadline
 * (last-write-wins in the map); the admin call-name grammar keeps names
 * unique in practice.
 * @param {Map<string, number>} deadlineByName - Call name -> deadline epoch ms.
 * @returns {(a: string, b: string) => number} Ascending-by-deadline comparator.
 */
export function datacallNameComparator(
  deadlineByName: Map<string, number>
): (a: string, b: string) => number {
  return (a, b) => {
    const av = deadlineByName.get(a) ?? -Infinity
    const bv = deadlineByName.get(b) ?? -Infinity
    if (av === bv) return 0
    return av - bv
  }
}

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
