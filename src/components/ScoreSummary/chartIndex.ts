/**
 * Index helpers for the trend chart's clicks and brush window.
 *
 * recharts 3 hands `activeTooltipIndex` over as a string ("2"), not a number.
 *
 * @module components/ScoreSummary/chartIndex
 */

/**
 * The clicked point's index, or null when the click landed on no point.
 * @param {{ activeTooltipIndex?: unknown } | null | undefined} state - The chart's click state.
 * @returns {number | null} A non-negative integer index, or null.
 */
export function clickedIndex(
  state: { activeTooltipIndex?: unknown } | null | undefined
): number | null {
  const raw = state?.activeTooltipIndex
  if (raw === null || raw === undefined || raw === '') return null
  const idx = Number(raw)
  return Number.isInteger(idx) && idx >= 0 ? idx : null
}

/** A brush window over a series, both ends inclusive. */
export type IndexWindow = { start: number; end: number }

/**
 * Slides a window just far enough to contain an index, keeping its width.
 * @param {IndexWindow} win - The current window.
 * @param {number} idx - The index that must be visible.
 * @returns {IndexWindow} The same window if it already contains idx.
 */
export function windowContaining(win: IndexWindow, idx: number): IndexWindow {
  const width = win.end - win.start
  if (idx < win.start) return { start: idx, end: idx + width }
  if (idx > win.end) return { start: idx - width, end: idx }
  return win
}
