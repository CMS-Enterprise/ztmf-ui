import type { PillarScore, ScoreAggregate } from '@/types'

export type RadarDatum = {
  pillar: string
  current: number
  previous?: number
}

/**
 * The comparison call's score for one pillar, matched on pillarid so a comparison
 * missing an earlier pillar cannot shift scores onto the wrong row. undefined when
 * that call has no row for the pillar.
 *
 * Shared by the chart and the accessible table that mirrors it, so the two cannot
 * disagree about what "no comparison" means.
 */
export function findComparisonPillarScore(
  comparisonScoreEntry: ScoreAggregate | null | undefined,
  pillarid: number
): number | undefined {
  return comparisonScoreEntry?.pillarscores?.find(
    (p) => p.pillarid === pillarid
  )?.score
}

/**
 * Builds the radar series from the anchor call's pillars, pairing each with the
 * comparison call's score for the same pillarid.
 *
 * `previous` stays undefined - never 0 - when the comparison call has no row for
 * that pillar. Scores are floored at 1.0, so 0 plotted a line into the centre of
 * the chart and read as a collapse rather than "not measured that cycle".
 * Reachable today for any system whose environment changed between cycles.
 *
 * Separate from the component so it can be tested; the rendered radar cannot be
 * inspected under jsdom.
 */
export function buildRadarData(
  anchorPillarScores: PillarScore[] | undefined,
  comparisonScoreEntry: ScoreAggregate | null | undefined
): RadarDatum[] {
  if (!anchorPillarScores) return []
  return anchorPillarScores.map((pillar) => ({
    pillar: pillar.pillar,
    current: pillar.score ?? 0,
    previous: findComparisonPillarScore(comparisonScoreEntry, pillar.pillarid),
  }))
}
