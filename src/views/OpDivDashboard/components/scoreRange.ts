/**
 * The spread of an OpDiv's scored systems, as the KPI tile states it.
 *
 * Its own module rather than a helper beside the component, so the three cases
 * can be pinned without rendering and the component file keeps exporting only
 * a component.
 *
 * @module views/OpDivDashboard/components/scoreRange
 */
import { tierForScore } from '@/utils/tierStyles'
import { stageColor } from './stageColor'
import type { ScoreTier } from '@/types'
import type { OpDivSummary } from '../opdivAggregates'

/** One end of the score range, with the color its own tier earns. */
export type RangeEnd = { text: string; tier: ScoreTier; color: string }

/** What the Score range tile renders. */
export type ScoreRange = {
  /** The weak end, or the single value when every system sits together. */
  low: RangeEnd | null
  /** Null when nothing is scored, or when both ends are the same score. */
  high: RangeEnd | null
  hint: string
}

/**
 * Builds the range figure from the summary's two extremes.
 *
 * Each end carries its OWN tier color rather than the pair sharing one. A
 * range is the one figure here that spans two bands by definition, so painting
 * it uniformly throws away the thing it exists to show - and painting it by
 * the low end alone made an estate reaching Optimal read as Traditional
 * purple. The tile this replaced was worse still: it gave every lowest score
 * the fixed "down" color, so a floor of 5.00 rendered as an alert.
 *
 * The tier is named in the hint as well, so the reading never depends on
 * telling two fills apart.
 * @param {Pick<OpDivSummary, 'highest' | 'lowest' | 'scoredCount'>} summary - The score extremes.
 * @returns {ScoreRange} Both ends and the qualifying hint.
 */
export function scoreRange(
  summary: Pick<OpDivSummary, 'highest' | 'lowest' | 'scoredCount'>
): ScoreRange {
  const { highest, lowest, scoredCount } = summary
  if (!lowest || !highest) {
    return { low: null, high: null, hint: 'nothing scored yet' }
  }
  const end = (score: number): RangeEnd => {
    const tier = tierForScore(score)
    return { text: score.toFixed(2), tier, color: stageColor(tier) }
  }
  // One value when every scored system sits at the same score: a "5.00-5.00"
  // range describes a difference that does not exist, and rendering it as one
  // invites the reader to look for a spread that is not there.
  if (Math.abs(highest.score - lowest.score) < 0.005) {
    return {
      low: end(lowest.score),
      high: null,
      hint: `all ${scoredCount} at ${tierForScore(lowest.score)}`,
    }
  }
  return {
    low: end(lowest.score),
    high: end(highest.score),
    hint: `${lowest.acronym} low · ${highest.acronym} high`,
  }
}
