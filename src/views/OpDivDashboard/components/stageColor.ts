/**
 * The one place a maturity bucket is turned into a color.
 *
 * Shared rather than duplicated per figure: the donut and the score bars drew
 * from two near-identical copies of this, and they drifted - one gave "No
 * score" the same hex as "Not Assessed", which collapsed the two largest
 * buckets of a mostly-unscored OpDiv into a single flat grey ring. One
 * function means that disagreement cannot reappear.
 *
 * @module views/OpDivDashboard/components/stageColor
 */
import { colors, tierDot } from '@/theme/tokens'
import type { ScoreTier } from '@/types'
import { NO_SCORE_LABEL } from '../opdivAggregates'

/**
 * Fill for a maturity bucket.
 *
 * "No score" and "Not Assessed" are both neutral - neither is an earned tier -
 * but they are deliberately DIFFERENT neutrals. A system with no score row was
 * never enrolled in the call; one tiered Not Assessed was enrolled and left
 * unanswered. The lighter step reads as "no data at all", which is what it is.
 * @param {string} label - A tier name or the no-score label.
 * @returns {string} A fill color.
 */
export function stageColor(label: string): string {
  if (label === NO_SCORE_LABEL) return colors.neutral200
  return tierDot[label as ScoreTier] ?? colors.neutral400
}
