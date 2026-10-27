/**
 * The spread of an OpDiv's scored systems, as the KPI tile states it.
 *
 * Its own module rather than a helper beside the component, so the three cases
 * can be pinned without rendering and the component file keeps exporting only
 * a component.
 *
 * @module components/ScoreSummary/scoreRange
 */
import { tierForScore } from '@/utils/tierStyles'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'
import type { ScoreTier } from '@/types'
import type {
  OpDivSummary,
  RangeExtreme,
} from '@/views/OpDivDashboard/opdivAggregates'

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
  const end = ({ score, tier: apiTier }: RangeExtreme): RangeEnd => {
    const tier = apiTier ?? tierForScore(score)
    // The chip palette, not the dot palette. tierDot is documented as accent
    // dots that sit BESIDE a value, and several of its colors fail WCAG AA as
    // text - Advanced (#C19A00) is 2.66:1 on white, which misses even the 3:1
    // large-text bar. TIER_CHIP_STYLES is the accessible source of truth and
    // clears 4.5:1 on every tier.
    return { text: score.toFixed(2), tier, color: TIER_CHIP_STYLES[tier].color }
  }
  // One value when every scored system sits at the same score: a "5.00-5.00"
  // range describes a difference that does not exist, and rendering it as one
  // invites the reader to look for a spread that is not there.
  if (Math.abs(highest.score - lowest.score) < 0.005) {
    return {
      low: end(lowest),
      high: null,
      hint: `all ${scoredCount} at ${end(lowest).tier}`,
    }
  }
  return {
    low: end(lowest),
    high: end(highest),
    hint: `${lowest.acronym} low · ${highest.acronym} high`,
  }
}
