/**
 * In-page jump from a summary tile to the panel that explains it.
 *
 * Scrolling alone was not enough to follow: the page moves, and on a dense
 * dashboard the panel that arrives under the cursor looks like every other
 * card, so the reader has to re-find what they clicked. So the target also
 * gets a brief ring and takes focus.
 *
 * Focus is the part that matters beyond looks. A scroll leaves the keyboard
 * caret back on the tile, so the next Tab continues through the summary rather
 * than into the panel just opened, and a screen reader is told nothing at all.
 * Moving focus makes the jump real for everyone rather than only for people
 * watching the viewport.
 *
 * @module views/OpDivDashboard/components/jumpToPanel
 */
import { colors } from '@/theme/tokens'

/** How long the ring stays before fading, in ms. */
export const HIGHLIGHT_HOLD_MS = 2000

/** Fade duration once the hold elapses, in ms. */
const FADE_MS = 400

/** The ring itself - a shadow, so nothing reflows when it appears. */
const RING = `0 0 0 3px ${colors.primary}`

/** Whether the reader has asked for less motion. */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    // matchMedia is absent in some test environments; assume motion is fine.
    return false
  }
}

/**
 * Scrolls to a panel, rings it briefly, and hands it focus.
 *
 * Safe to call for an id that is not on the page - a panel can be suppressed
 * when it has nothing to report, and a tile linking to it should do nothing
 * rather than throw.
 * @param {string} id - The target panel's element id.
 * @returns {void}
 */
export function jumpToPanel(id: string): void {
  const el = document.getElementById(id)
  if (!el) return

  const reduced = prefersReducedMotion()
  el.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'center',
  })

  // Panels are plain containers, so they need a tabindex to be focusable at
  // all. -1 keeps them out of the tab sequence: this is a jump destination,
  // not a stop on the way through the page.
  el.setAttribute('tabindex', '-1')
  // preventScroll, or the browser's own focus scroll fights the smooth one
  // just started and the page lands with a jerk.
  el.focus({ preventScroll: true })

  el.style.transition = reduced ? '' : `box-shadow ${FADE_MS}ms ease-out`
  el.style.boxShadow = RING

  window.setTimeout(() => {
    el.style.boxShadow = ''
    // Clear the transition only after the fade has run, so removing it does
    // not cut the fade short.
    window.setTimeout(() => {
      el.style.transition = ''
      el.style.removeProperty('box-shadow')
      el.style.removeProperty('transition')
    }, FADE_MS)
  }, HIGHLIGHT_HOLD_MS)
}
