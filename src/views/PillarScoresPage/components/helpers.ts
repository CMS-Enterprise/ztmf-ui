import { PILLAR_ORDER } from '@/constants'

/**
 * Pure helpers shared across the Pillar Scores view layer. Kept separate
 * from any component module so React Fast Refresh can hot-swap components
 * without invalidating the surrounding helpers.
 */

/**
 * Returns the index of a pillar name in the canonical {@link PILLAR_ORDER},
 * or {@link Number.MAX_SAFE_INTEGER} when the name is unknown. Used as a
 * sort key so callers can stably order pillar rows without needing to know
 * the canonical sequence themselves.
 * @param {string | undefined} name - Pillar name.
 * @returns {number} The sort index, MAX_SAFE_INTEGER for unknown names.
 */
export function pillarRank(name: string | undefined): number {
  if (!name) return Number.MAX_SAFE_INTEGER
  const i = PILLAR_ORDER.indexOf(name)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

/**
 * Classifies the delta between a current and previous score as up, down or
 * flat. A movement smaller than ~0.005 reads as flat so floating-point
 * jitter does not flip the indicator under no real change.
 * @param {number} current - The current period's score.
 * @param {number} [previous] - The prior period's score; undefined when
 *   there is no comparison baseline yet.
 * @returns {'up' | 'down' | 'flat' | undefined} The classification, or
 *   undefined when a previous value is not available.
 */
export function trendDirection(
  current: number,
  previous?: number
): 'up' | 'down' | 'flat' | undefined {
  if (typeof previous !== 'number') return undefined
  const delta = current - previous
  if (Math.abs(delta) < 0.005) return 'flat'
  return delta > 0 ? 'up' : 'down'
}
