import type { SystemScoreEntry } from '@/types'

/**
 * Sort key for the Zero Trust Score column. A system with no aggregate row has
 * never been assessed, so it sorts below a genuine zero and the two never
 * interleave; a scored system sorts by its numeric score.
 * @param {SystemScoreEntry | undefined} entry - The system's score entry, if any.
 * @returns {number} The numeric sort key (-1 when never assessed).
 */
export function scoreSortValue(entry: SystemScoreEntry | undefined): number {
  if (!entry) return -1
  return entry.score ?? 0
}
