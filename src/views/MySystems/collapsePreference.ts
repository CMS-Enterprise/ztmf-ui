/**
 * Whether the summary band is collapsed, remembered between visits.
 *
 * localStorage rather than sessionStorage: this is a standing preference about
 * how someone wants their dashboard to look, not a fact about the current tab.
 * An ISSO who works out of the systems table collapses it once and expects it
 * to stay that way tomorrow.
 *
 * @module views/MySystems/collapsePreference
 */

const COLLAPSED_KEY = 'ztmf.mySystemsCollapsed'

/**
 * Reads the remembered collapse state for the DETAIL panels.
 *
 * Defaults to collapsed. The headline row renders either way, so a first visit
 * still gets the score and the alert tiles - and leaving the detail open by
 * default pushed the systems table most of a screen down for the sake of cards
 * that, against a young dataset, mostly had nothing to say.
 *
 * Only an explicit stored 'false' expands, so a stored value is required to
 * opt in rather than to opt out.
 * @returns {boolean} True when the detail should render collapsed.
 */
export function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) !== 'false'
  } catch {
    // Private mode / disabled storage. Remembering the choice is a
    // convenience, never a requirement.
    return true
  }
}

/**
 * Remembers the collapse state.
 * @param {boolean} collapsed - The new state.
 * @returns {void}
 */
export function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  } catch {
    // Ignored, as above.
  }
}
