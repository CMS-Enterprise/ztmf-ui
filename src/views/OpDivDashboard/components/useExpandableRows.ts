/**
 * Collapsed / expanded state for a panel's worklist, with a hard ceiling.
 *
 * Every worklist here caps how many systems it names. Expanding reveals the
 * rest - but "the rest" is not always a handful: at the start of a data call
 * every enrolled system is on the not-started list, which at CMS scale is four
 * figures, and a thousand rows inside a summary card is not a list anyone can
 * read or a DOM anyone should pay for.
 *
 * So expanding opens up to MAX_EXPANDED and stops, saying how many are still
 * unnamed. The systems table below is where a four-figure list belongs; this
 * panel's job is the top of it.
 *
 * @module views/OpDivDashboard/components/useExpandableRows
 */
import { useState } from 'react'

/**
 * Most rows a panel will render even when expanded.
 *
 * Chosen to be comfortably more than any list someone would actually work
 * through in a card, and far below the point where the DOM cost shows.
 */
export const MAX_EXPANDED = 50

/** What {@link useExpandableRows} returns. */
export type ExpandableRows<T> = {
  /** The rows to render right now. */
  listed: T[]
  /** How many are not rendered, collapsed or expanded. */
  hidden: number
  expanded: boolean
  toggle: () => void
  /** True when even the expanded list is truncated. */
  cappedAtMax: boolean
}

/**
 * Splits a list into what a panel shows and what it withholds.
 * @param {T[]} rows - The full list, already ordered worst-first.
 * @param {number} collapsedMax - How many to name before expanding.
 * @returns {ExpandableRows<T>} Rows to render plus the toggle state.
 */
export function useExpandableRows<T>(
  rows: T[],
  collapsedMax: number
): ExpandableRows<T> {
  const [expanded, setExpanded] = useState(false)
  const limit = expanded ? MAX_EXPANDED : collapsedMax
  const listed = rows.slice(0, limit)
  return {
    listed,
    hidden: rows.length - listed.length,
    expanded,
    toggle: () => setExpanded((open) => !open),
    cappedAtMax: expanded && rows.length > MAX_EXPANDED,
  }
}
