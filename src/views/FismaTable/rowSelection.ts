import type { ScoreProgress, SystemScoreEntry } from '@/types'

/**
 * Whether a dashboard row can be selected for the answers export.
 *
 * A system is selectable if it appears in the viewed data calls at all: with a
 * score row or with a questionnaire-progress row. Keying off scores alone hid
 * not-started systems (a progress row of 40 expected / 0 updated but no score
 * yet), which are exactly the ones an OpDiv admin most needs to select, and
 * left their checkbox permanently unchecked with no visible reason. The union
 * with scores keeps scored rows selectable even if the progress fetch fails and
 * resolves to an empty map; a not-started system exists only in progress, so it
 * still needs that fetch to have succeeded to be selectable.
 * @param {number} fismasystemid - The row's system id.
 * @param {Record<number, SystemScoreEntry>} scores - Per-system score entries.
 * @param {Record<number, ScoreProgress>} [progress] - Per-system progress rows.
 * @returns {boolean} True when the row can be selected.
 */
export function isSystemSelectable(
  fismasystemid: number,
  scores: Record<number, SystemScoreEntry>,
  progress?: Record<number, ScoreProgress>
): boolean {
  return fismasystemid in scores || fismasystemid in (progress ?? {})
}
