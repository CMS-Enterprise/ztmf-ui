/**
 * Per-pillar averages across an OpDiv.
 *
 * The denominator varies by pillar and that is not a bug to smooth over. A
 * SaaS system is scored on four pillars, not six - Devices and Applications
 * are out of scope for it from the FY26 cycle on - so it emits no row at all
 * for those two, and they are averaged over fewer systems than their
 * neighbours. Three ways to get this wrong:
 *
 *  - treat a missing pillar as 0 -> that pillar's average collapses;
 *  - divide by the full scored-system count -> the same collapse, subtler;
 *  - predict which systems are reduced from `cloud_service_model` -> wrong
 *    source, and demonstrably so: the SaaS systems in the current data carry
 *    `datacenterenvironment: 'SaaS'` (which is what the rule keys on, via
 *    datacenterenvironments.scoring_key) while their `cloud_service_model` is
 *    null. Predicting from the service-model list misses every one of them.
 *
 * So the count is derived from the response: only systems that actually carry
 * a row for a pillar contribute to it, and the resulting `n` is reported to
 * the chart so a shorter denominator is visible rather than implied.
 *
 * @module views/OpDivDashboard/opdivPillars
 */
import { tierForScore } from '@/utils/tierStyles'
import type { ScoreAggregate, ScoreTier } from '@/types'

/**
 * Per-system pillar scores, keyed by pillar id, for systems in scope.
 * @param {ScoreAggregate[]} aggregates - Rows from a pillar-bearing aggregate.
 * @param {Set<number>} systemIds - The OpDiv's system ids.
 * @returns {Map<number, Map<number, number>>} systemId -> pillarid -> score.
 */
export function pillarScoresBySystem(
  aggregates: ScoreAggregate[],
  systemIds: Set<number>
): Map<number, Map<number, number>> {
  const bySystem = new Map<number, Map<number, number>>()
  for (const row of aggregates) {
    if (!systemIds.has(row.fismasystemid)) continue
    const pillars = row.pillarscores
    if (!pillars || pillars.length === 0) continue
    const scores = new Map<number, number>()
    for (const p of pillars) scores.set(p.pillarid, p.score)
    bySystem.set(row.fismasystemid, scores)
  }
  return bySystem
}

/**
 * Pillar ids in the order the API serves them, merged across rows.
 *
 * Each row's pillar scores arrive ordered by pillars.ordr, but a reduced-scope
 * row omits pillars, so first appearance alone would push them last when such
 * a row comes first. Merges every row's sequence as precedence constraints;
 * pillars no row orders relative to each other fall back to pillarid.
 * @param {ScoreAggregate[]} aggregates - Rows from a pillar-bearing aggregate.
 * @returns {number[]} Pillar ids in API order.
 */
export function pillarOrder(aggregates: ScoreAggregate[]): number[] {
  const after = new Map<number, Set<number>>()
  const inDegree = new Map<number, number>()
  for (const row of aggregates) {
    let prev: number | null = null
    for (const { pillarid } of row.pillarscores ?? []) {
      if (!after.has(pillarid)) {
        after.set(pillarid, new Set())
        inDegree.set(pillarid, 0)
      }
      const next: Set<number> | null =
        prev === null ? null : (after.get(prev) as Set<number>)
      if (next && prev !== pillarid && !next.has(pillarid)) {
        next.add(pillarid)
        inDegree.set(pillarid, (inDegree.get(pillarid) as number) + 1)
      }
      prev = pillarid
    }
  }

  const order: number[] = []
  const remaining = new Set(after.keys())
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => inDegree.get(id) === 0)
    // Rows that disagree leave a cycle; break it on pillarid rather than stall.
    const id = Math.min(...(ready.length > 0 ? ready : remaining))
    remaining.delete(id)
    order.push(id)
    for (const successor of after.get(id) as Set<number>) {
      inDegree.set(successor, (inDegree.get(successor) as number) - 1)
    }
  }
  return order
}

/** One pillar's average across the OpDiv. */
export type PillarAverage = {
  pillarid: number
  pillar: string
  avg: number
  /** Systems that contributed a row for this pillar. */
  n: number
  /** Scored systems in the OpDiv carrying no row for this pillar. */
  outOfScope: number
  /** Band the average falls in, so a bare number reads as a standing. */
  tier: ScoreTier
  /** Change vs the prior call, paired by system. Null without a baseline. */
  delta: number | null
  /** Systems carrying this pillar in BOTH calls - the pairing behind delta. */
  deltaN: number
}

/**
 * Averages each pillar over the systems that carry a row for it.
 *
 * Rows for systems outside `systemIds` are discarded - the aggregate endpoint
 * has no decommissioned filter and is not OpDiv-scopeable, so it returns rows
 * for systems this page has no record of.
 * @param {ScoreAggregate[]} aggregates - Rows from a pillar-bearing aggregate.
 * @param {Set<number>} systemIds - The OpDiv's system ids.
 * @returns {PillarAverage[]} Averages in API pillar order.
 */
export function averageByPillar(
  aggregates: ScoreAggregate[],
  systemIds: Set<number>,
  priorAggregates: ScoreAggregate[] = []
): PillarAverage[] {
  const sums = new Map<number, { pillar: string; sum: number; n: number }>()
  let scoredSystems = 0

  for (const row of aggregates) {
    if (!systemIds.has(row.fismasystemid)) continue
    const pillars = row.pillarscores
    if (!pillars || pillars.length === 0) continue
    scoredSystems += 1
    for (const p of pillars) {
      const entry = sums.get(p.pillarid)
      if (entry) {
        entry.sum += p.score
        entry.n += 1
      } else {
        sums.set(p.pillarid, { pillar: p.pillar, sum: p.score, n: 1 })
      }
    }
  }

  // Paired per pillar, for the same reason the headline delta is paired: a
  // pillar whose participating systems changed between cycles would otherwise
  // show movement nobody made. Only systems carrying the pillar in BOTH calls
  // contribute, which also means a reduced-scope pillar compares like for like.
  const current = pillarScoresBySystem(aggregates, systemIds)
  const prior = pillarScoresBySystem(priorAggregates, systemIds)
  const deltas = new Map<number, { sum: number; n: number }>()
  for (const [systemId, currentScores] of current) {
    const priorScores = prior.get(systemId)
    if (!priorScores) continue
    for (const [pillarid, score] of currentScores) {
      const before = priorScores.get(pillarid)
      if (before === undefined) continue
      const entry = deltas.get(pillarid)
      if (entry) {
        entry.sum += score - before
        entry.n += 1
      } else {
        deltas.set(pillarid, { sum: score - before, n: 1 })
      }
    }
  }

  const rank = new Map(pillarOrder(aggregates).map((id, i) => [id, i]))
  return [...sums.entries()]
    .map(([pillarid, { pillar, sum, n }]) => {
      const paired = deltas.get(pillarid)
      return {
        pillarid,
        pillar,
        avg: sum / n,
        n,
        // How many scored systems sat this pillar out. Non-zero means the bar's
        // denominator is genuinely smaller than the OpDiv, and the chart says so.
        outOfScope: scoredSystems - n,
        // An OpDiv-level average is not a graded system, so there is no API
        // tier for it - the documented case for deriving from the number.
        tier: tierForScore(sum / n),
        delta: paired && paired.n > 0 ? paired.sum / paired.n : null,
        deltaN: paired?.n ?? 0,
      }
    })
    .sort(
      (a, b) =>
        (rank.get(a.pillarid) as number) - (rank.get(b.pillarid) as number)
    )
}

/** Which pillar drags a system down, counted across the OpDiv. */
export type PillarExtremeCounts = {
  /** The pillar that is lowest for the most systems. */
  weakest: { pillar: string; count: number } | null
  /** The pillar that is highest for the most systems. */
  strongest: { pillar: string; count: number } | null
  /** Systems with pillar detail behind the counts. */
  systems: number
}

/**
 * Counts, per pillar, how many systems have it as their lowest and highest.
 *
 * Six averages say where the OpDiv stands; this says where it is actually
 * losing points. An average can sit mid-range because a few systems are awful
 * at a pillar or because every system is mediocre at it, and those call for
 * different responses.
 *
 * A system with several pillars tied at its minimum contributes to the first
 * in API pillar order only, so the counts sum to the number of systems rather
 * than double-counting ties.
 * @param {ScoreAggregate[]} aggregates - Rows from a pillar-bearing aggregate.
 * @param {Set<number>} systemIds - The OpDiv's system ids.
 * @returns {PillarExtremeCounts} The most common weakest and strongest pillars.
 */
export function pillarExtremeCounts(
  aggregates: ScoreAggregate[],
  systemIds: Set<number>
): PillarExtremeCounts {
  const names = new Map<number, string>()
  for (const row of aggregates) {
    for (const p of row.pillarscores ?? []) names.set(p.pillarid, p.pillar)
  }
  const ordered = pillarOrder(aggregates).map(
    (id) => [id, names.get(id) as string] as const
  )

  const lowCounts = new Map<string, number>()
  const highCounts = new Map<string, number>()
  let systems = 0

  for (const [, scores] of pillarScoresBySystem(aggregates, systemIds)) {
    systems += 1
    let low: string | null = null
    let high: string | null = null
    let lowScore = Infinity
    let highScore = -Infinity
    // Walk in API order so a tie resolves to the same pillar every time.
    for (const [pillarid, pillar] of ordered) {
      const score = scores.get(pillarid)
      if (score === undefined) continue
      if (score < lowScore) {
        lowScore = score
        low = pillar
      }
      if (score > highScore) {
        highScore = score
        high = pillar
      }
    }
    if (low) lowCounts.set(low, (lowCounts.get(low) ?? 0) + 1)
    if (high) highCounts.set(high, (highCounts.get(high) ?? 0) + 1)
  }

  const top = (counts: Map<string, number>) => {
    let best: { pillar: string; count: number } | null = null
    for (const [pillar, count] of counts) {
      if (!best || count > best.count) best = { pillar, count }
    }
    return best
  }

  return { weakest: top(lowCounts), strongest: top(highCounts), systems }
}
