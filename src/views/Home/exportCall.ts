/**
 * The single data call an export of the selected rows should target, or null
 * when there is no unambiguous target (the Export button disables then).
 *
 * Resolution per selected row: the calls the system has scores in
 * (systemCallMap); a not-started system has no score-derived call, so it
 * falls back to the call the dashboard displays it against (chosenCallMap,
 * filled for every selectable row) - otherwise an all-never-started selection
 * would fall through to the active call, wrong in a past-year view. An empty
 * selection exports the active call; a selection spanning more than one call
 * has no single target.
 * @param {number[]} selectedRows - Selected fismasystemids.
 * @param {Record<number, number[]>} systemCallMap - System id -> call ids it
 *   has scores in.
 * @param {Record<number, number>} chosenCallMap - System id -> the call the
 *   dashboard displays the row against.
 * @param {number} activeDataCallId - The dashboard's active call id.
 * @returns {number | null} The export target call id, or null when ambiguous.
 */
export function deriveExportCallId(
  selectedRows: number[],
  systemCallMap: Record<number, number[]>,
  chosenCallMap: Record<number, number>,
  activeDataCallId: number
): number | null {
  const selectedCallIds = new Set<number>()
  for (const id of selectedRows) {
    const scoreCalls = systemCallMap[id] ?? []
    if (scoreCalls.length > 0) {
      for (const cid of scoreCalls) selectedCallIds.add(cid)
    } else {
      const chosen = chosenCallMap[id]
      if (chosen != null) selectedCallIds.add(chosen)
    }
  }
  if (selectedCallIds.size === 1) return [...selectedCallIds][0]
  if (selectedCallIds.size === 0) return activeDataCallId
  return null
}
