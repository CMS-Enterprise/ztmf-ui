import type { datacall } from '@/types'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'

/**
 * Sort comparator for the Data Call column. Cell values are call NAMES (so
 * the quick filter can match them), but names do not sort chronologically
 * ("FY2025 Q3" string-sorts near "FY25 ZTM" by accident only), so ordering
 * goes through each call's deadline. A name with no known deadline, or one
 * whose deadline failed to parse, sinks to the oldest end rather than
 * interleaving (mirrors sortDatacallsByDeadline's bad-value handling).
 * Duplicate call names collapse to one deadline (last-write-wins in the map);
 * the admin call-name grammar keeps names unique in practice.
 * @param {Map<string, number>} deadlineByName - Call name -> deadline epoch ms.
 * @returns {(a: string, b: string) => number} Ascending-by-deadline comparator.
 */
export function datacallNameComparator(
  deadlineByName: Map<string, number>
): (a: string, b: string) => number {
  // A name absent from the map and a name mapped to NaN (empty or malformed
  // deadline on a real record) both have to land on the same finite sentinel.
  // Returning NaN from a comparator is outside Array.prototype.sort's contract
  // and leaves the row's position engine-dependent.
  const key = (name: string): number => {
    const value = deadlineByName.get(name)
    return value === undefined || Number.isNaN(value) ? -Infinity : value
  }
  return (a, b) => {
    const av = key(a)
    const bv = key(b)
    if (av === bv) return 0
    return av - bv
  }
}

/**
 * The data call a dashboard row is displaying. One source of truth shared by
 * the Data Call column, the past-call row styling, and the Pillar Scores
 * modal, so a cell and the modal it opens can never disagree about which call
 * a row is on.
 *
 * Resolution order: the call chosen by most-recently-updated in
 * buildDashboardMaps; else the newest-by-deadline call the system has scores
 * in; else a call that is actually in the current view.
 *
 * That last rung matters. activeDataCallId collapses to the newest call
 * whenever more than one call is toggled on, and selecting a year toggles all
 * of its calls, so for any multi-call year it points at the open call rather
 * than anything on screen. Naming it would label a row in a historical view
 * with the current call, and hand the Pillar Scores modal an id the row has no
 * score for, which sends the modal down its own fallback and lets the column
 * and the modal name different calls. Preferring the newest call in view keeps
 * the label inside what the user is looking at.
 * @param {number} fismasystemid - The row's system id.
 * @param {Record<number, number>} chosenCallMap - System id -> displayed call id.
 * @param {Record<number, number[]>} systemCallMap - System id -> call ids with scores.
 * @param {datacall[]} datacalls - All known data calls.
 * @param {number} activeDataCallId - The dashboard's active call id.
 * @param {number[]} [activeDatacallIds] - Call ids selected in the year picker.
 *   Omit to keep the pre-existing activeDataCallId-only behavior.
 * @returns {number} The resolved data call id.
 */
export function resolveRowCallId(
  fismasystemid: number,
  chosenCallMap: Record<number, number>,
  systemCallMap: Record<number, number[]>,
  datacalls: datacall[],
  activeDataCallId: number,
  activeDatacallIds?: number[]
): number {
  const chosen = chosenCallMap[fismasystemid]
  if (chosen != null) return chosen

  const scored = sortDatacallsByDeadline(
    (systemCallMap[fismasystemid] ?? [])
      .map((id) => datacalls.find((d) => d.datacallid === id))
      .filter((d): d is datacall => Boolean(d))
  )[0]?.datacallid
  if (scored != null) return scored

  if (activeDatacallIds?.length) {
    if (activeDatacallIds.includes(activeDataCallId)) return activeDataCallId
    const newestInView = sortDatacallsByDeadline(
      activeDatacallIds
        .map((id) => datacalls.find((d) => d.datacallid === id))
        .filter((d): d is datacall => Boolean(d))
    )[0]?.datacallid
    if (newestInView != null) return newestInView
  }
  return activeDataCallId
}

/**
 * The data call the questionnaire icon opens for a row, as a full datacall
 * object. Resolves through resolveRowCallId - the exact path the Data Call
 * column uses - so the column label and the call the icon opens always name the
 * same call. This covers a score-less row (whose column used to disagree with
 * the icon's active-call fallback) and a row scored in an older call but
 * displayed against a newer one (which reads as "Not scored" and must open the
 * call it is shown against, not the hidden older score). Systems scored in more
 * than one active call open the call picker before this is reached.
 * @param {number} fismasystemid - The row's system id.
 * @param {Record<number, number>} chosenCallMap - System id -> displayed call id.
 * @param {Record<number, number[]>} systemCallMap - System id -> call ids with scores.
 * @param {datacall[]} datacalls - All known data calls.
 * @param {number} activeDataCallId - The dashboard's active call id.
 * @param {number[]} [activeDatacallIds] - Call ids selected in the year picker.
 * @returns {datacall | undefined} The call to open, or undefined if none resolves.
 */
export function resolveQuestionnaireCall(
  fismasystemid: number,
  chosenCallMap: Record<number, number>,
  systemCallMap: Record<number, number[]>,
  datacalls: datacall[],
  activeDataCallId: number,
  activeDatacallIds?: number[]
): datacall | undefined {
  const id = resolveRowCallId(
    fismasystemid,
    chosenCallMap,
    systemCallMap,
    datacalls,
    activeDataCallId,
    activeDatacallIds
  )
  return datacalls.find((d) => d.datacallid === id)
}
