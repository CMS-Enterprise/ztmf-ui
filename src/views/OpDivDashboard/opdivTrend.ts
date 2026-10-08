/**
 * The OpDiv's score trend across data calls.
 *
 * Scope caveat worth stating plainly, because the chart has to say it too:
 * the series is "today's active systems, scored historically", not "what this
 * OpDiv averaged at the time". Systems are attributed to an OpDiv from the
 * client's systems list, which is active-only, so a system decommissioned
 * last cycle leaves every historical point retroactively. Showing that as a
 * clean trend without a caption would be survivorship bias.
 *
 * @module views/OpDivDashboard/opdivTrend
 */
import { parseDatacallName } from '@/utils/datacallGrouping'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import type {
  FismaSystemType,
  ScoreAggregate,
  ScoreTier,
  datacall,
} from '@/types'

/** The OpDiv that runs quarterly calls rather than the annual ZTM cycle. */
const QUARTERLY_OPDIV_CODE = 'CMS'

/**
 * Smallest score change worth calling a change.
 *
 * Scores carry more precision than they are ever rendered at, so a move below
 * this would show up as a system that "changed" from 3.00 to 3.00.
 */
const MIN_VISIBLE_SCORE_CHANGE = 0.005

/**
 * The data calls a given OpDiv's trend should plot.
 *
 * The two cadences are not comparable and plotting them on one axis is what
 * made the line oscillate: CMS runs quarterly calls (`FY2025 Q3`) while every
 * other OpDiv runs the annual ZTM cycle (`FY25 ZTM`), so alternating between
 * them reads as an OpDiv repeatedly gaining and losing a point of maturity
 * when it is really two different populations taking turns.
 *
 * So each OpDiv follows its own cadence, with one exception: the newest annual
 * call is the first cycle everyone ran together, so it joins the CMS series as
 * its most recent point. The aggregate follows the annual cadence, being the
 * only one every OpDiv participates in.
 * @param {datacall[]} datacalls - All known data calls.
 * @param {string | null} opdivCode - The OpDiv's code, or null to aggregate.
 * @returns {datacall[]} The calls to plot, deadline-ascending.
 */
export function selectTrendCalls(
  datacalls: datacall[],
  opdivCode: string | null
): datacall[] {
  const annual: datacall[] = []
  const quarterly: datacall[] = []
  for (const dc of datacalls) {
    // 'HHS' is the annual ZTM cadence, 'CMS' the quarterly one. Names outside
    // the grammar ('Other') are dropped rather than guessed at - an
    // unclassifiable call has no series to belong to.
    const { tenant } = parseDatacallName(dc.datacall)
    if (tenant === 'HHS') annual.push(dc)
    else if (tenant === 'CMS') quarterly.push(dc)
  }

  if (opdivCode !== QUARTERLY_OPDIV_CODE) {
    return sortDatacallsByDeadline(annual).reverse()
  }

  // sortDatacallsByDeadline is newest-first, so the shared cycle is its head.
  const newestAnnual = sortDatacallsByDeadline(annual)[0]
  const series = newestAnnual ? [...quarterly, newestAnnual] : quarterly
  return sortDatacallsByDeadline(series).reverse()
}

/**
 * The baseline call for a paired comparison: the latest call in the scope's
 * cadence (see {@link selectTrendCalls}) due strictly before the anchor.
 * @param {datacall[]} datacalls - All known data calls.
 * @param {string | null} opdivCode - The OpDiv's code, or null to aggregate.
 * @param {datacall | null} anchor - The call being reported.
 * @returns {datacall | null} The prior call, or null when none precedes it.
 */
export function selectPriorCall(
  datacalls: datacall[],
  opdivCode: string | null,
  anchor: datacall | null
): datacall | null {
  if (!anchor) return null
  const cutoff = new Date(anchor.deadline).getTime()
  const earlier = selectTrendCalls(datacalls, opdivCode).filter(
    (dc) => new Date(dc.deadline).getTime() < cutoff
  )
  return earlier[earlier.length - 1] ?? null
}

/** One point on the trend line. */
export type TrendPoint = {
  datacallid: number
  /** Data-call display name. */
  label: string
  deadline: string
  /** Null when no in-scope system was scored in that call. */
  avg: number | null
  /** Scored systems behind the point - surfaced so a thin point is visible. */
  n: number
}

/**
 * Builds the per-call average series for one OpDiv.
 *
 * Calls the client cannot name are dropped rather than plotted under a raw id:
 * an unlabeled point on a time axis has no position anyone can read.
 * @param {ScoreAggregate[]} history - Rows from the full-series aggregate.
 * @param {Set<number>} systemIds - The OpDiv's system ids.
 * @param {datacall[]} datacalls - All known data calls, for labels and order.
 * @returns {TrendPoint[]} Points in deadline order, oldest first.
 */
export function buildTrendSeries(
  history: ScoreAggregate[],
  systemIds: Set<number>,
  datacalls: datacall[]
): TrendPoint[] {
  const byCall = new Map<number, { sum: number; n: number }>()
  for (const row of history) {
    if (!systemIds.has(row.fismasystemid)) continue
    // Floored at 1.0 upstream, so a falsy score is an absent one.
    if (!row.systemscore) continue
    const entry = byCall.get(row.datacallid)
    if (entry) {
      entry.sum += row.systemscore
      entry.n += 1
    } else {
      byCall.set(row.datacallid, { sum: row.systemscore, n: 1 })
    }
  }

  const points: TrendPoint[] = []
  for (const dc of datacalls) {
    const entry = byCall.get(dc.datacallid)
    if (!entry) continue
    points.push({
      datacallid: dc.datacallid,
      label: dc.datacall,
      deadline: dc.deadline,
      avg: entry.n > 0 ? entry.sum / entry.n : null,
      n: entry.n,
    })
  }

  // Oldest first, so the line reads left-to-right as time. Deadline drives the
  // order, not datacallid: backfilled historical calls can carry higher ids.
  return points.sort(
    (a, b) =>
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime() ||
      a.datacallid - b.datacallid
  )
}

/** Headline facts about a trend series. */
export type TrendSummary = {
  /** Data calls with at least one scored in-scope system. */
  calls: number
  best: TrendPoint | null
  worst: TrendPoint | null
  /** Latest minus earliest, or null with fewer than two points. */
  net: number | null
  first: TrendPoint | null
  latest: TrendPoint | null
}

/**
 * Reduces a trend series to the facts worth stating beside it.
 *
 * A line shows shape; these answer the questions the shape prompts - how far
 * back it goes, which cycle was best and worst, and whether the OpDiv is ahead
 * of where it started.
 * @param {TrendPoint[]} points - The series, deadline-ascending.
 * @returns {TrendSummary} The summary.
 */
export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  const scored = points.filter((p) => p.avg !== null)
  if (scored.length === 0) {
    return {
      calls: 0,
      best: null,
      worst: null,
      net: null,
      first: null,
      latest: null,
    }
  }
  let best = scored[0]
  let worst = scored[0]
  for (const point of scored) {
    if ((point.avg as number) > (best.avg as number)) best = point
    if ((point.avg as number) < (worst.avg as number)) worst = point
  }
  const first = scored[0]
  const latest = scored[scored.length - 1]
  return {
    calls: scored.length,
    best,
    worst,
    // Endpoint-to-endpoint, deliberately not paired by system: this describes
    // the series that is plotted, and the hero already carries the paired
    // like-for-like comparison against the prior call.
    net:
      scored.length > 1 ? (latest.avg as number) - (first.avg as number) : null,
    first,
    latest,
  }
}

/** Tiers best-first, so a distribution reads top to bottom as a ranking. */
const TIER_DISPLAY_ORDER: ScoreTier[] = [
  'Optimal',
  'Advanced',
  'Initial',
  'Traditional',
  'Not Assessed',
]

/** How many systems held each tier in one data call. */
export type TierCount = { tier: ScoreTier; count: number }

/**
 * The tier distribution of one data call.
 *
 * The average beside it says where the OpDiv's centre sat; this says how its
 * systems were spread, which the average cannot - the same 3.20 comes from a
 * uniformly Advanced OpDiv and from one split between Optimal and Traditional,
 * and only the second is a problem to work on.
 *
 * Tiers come from the response, never re-derived from the score.
 * @param {ScoreAggregate[]} history - Rows from the full-series aggregate.
 * @param {Set<number>} systemIds - The OpDiv's system ids.
 * @param {number} [datacallid] - The call to describe.
 * @returns {TierCount[]} Occupied tiers, best first.
 */
export function tierDistribution(
  history: ScoreAggregate[],
  systemIds: Set<number>,
  datacallid?: number
): TierCount[] {
  if (datacallid === undefined) return []
  const counts = new Map<ScoreTier, number>()
  for (const row of history) {
    if (row.datacallid !== datacallid) continue
    if (!systemIds.has(row.fismasystemid)) continue
    if (!row.systemtier) continue
    counts.set(row.systemtier, (counts.get(row.systemtier) ?? 0) + 1)
  }
  // Empty tiers are dropped rather than plotted at zero - a row of zeros is
  // noise in a five-row list.
  return TIER_DISPLAY_ORDER.filter((tier) => counts.has(tier)).map((tier) => ({
    tier,
    count: counts.get(tier) as number,
  }))
}

/** One system's score change between two calls. */
export type ScoreMover = {
  fismasystemid: number
  acronym: string
  from: number
  to: number
  /** Signed; never zero, since unchanged systems are not movers. */
  delta: number
}

/** The systems that moved most between two calls. */
export type Movers = {
  /** Largest gains first. */
  gained: ScoreMover[]
  /** Largest losses first. */
  lost: ScoreMover[]
  /** Systems scored in BOTH calls - the pairing behind the lists. */
  paired: number
  /** Of those, the ones whose score did not move at all. */
  unchanged: number
}

/**
 * The systems behind a step in the line.
 *
 * A trend point moving is the start of a question, not the end of one: an
 * OpDiv average that drops 0.15 is either one system falling off a cliff or
 * forty drifting, and the two want completely different responses. This names
 * which.
 *
 * Paired like {@link pairedDelta} - a system scored in only one of the two
 * calls has no movement to report, and counting its absence as a change is how
 * a shifting system mix masquerades as progress.
 * @param {ScoreAggregate[]} history - Rows covering both calls.
 * @param {FismaSystemType[]} systems - The OpDiv's systems, for names.
 * @param {number} [currentCallId] - The call being reported.
 * @param {number} [priorCallId] - The baseline call.
 * @param {number} [limit] - How many to keep at each end.
 * @returns {Movers} The two ends plus the pairing counts.
 */
export function biggestMovers(
  history: ScoreAggregate[],
  systems: FismaSystemType[],
  currentCallId?: number,
  priorCallId?: number,
  limit = 3
): Movers {
  const empty: Movers = { gained: [], lost: [], paired: 0, unchanged: 0 }
  if (currentCallId === undefined || priorCallId === undefined) return empty

  const names = new Map(
    systems.map((s) => [s.fismasystemid, s.fismaacronym] as const)
  )
  const current = new Map<number, number>()
  const prior = new Map<number, number>()
  for (const row of history) {
    if (!names.has(row.fismasystemid)) continue
    if (!row.systemscore) continue
    if (row.datacallid === currentCallId)
      current.set(row.fismasystemid, row.systemscore)
    else if (row.datacallid === priorCallId)
      prior.set(row.fismasystemid, row.systemscore)
  }

  const moved: ScoreMover[] = []
  let paired = 0
  let unchanged = 0
  for (const [fismasystemid, to] of current) {
    const from = prior.get(fismasystemid)
    if (from === undefined) continue
    paired += 1
    const delta = to - from
    if (Math.abs(delta) < MIN_VISIBLE_SCORE_CHANGE) {
      unchanged += 1
      continue
    }
    moved.push({
      fismasystemid,
      acronym: names.get(fismasystemid) as string,
      from,
      to,
      delta,
    })
  }

  const byMagnitude = (a: ScoreMover, b: ScoreMover) =>
    Math.abs(b.delta) - Math.abs(a.delta) || a.acronym.localeCompare(b.acronym)
  return {
    gained: moved
      .filter((m) => m.delta > 0)
      .sort(byMagnitude)
      .slice(0, limit),
    lost: moved
      .filter((m) => m.delta < 0)
      .sort(byMagnitude)
      .slice(0, limit),
    paired,
    unchanged,
  }
}

/** A current-vs-prior comparison over a fixed set of systems. */
export type PairedDelta = {
  /** Null when the two calls share no scored system. */
  delta: number | null
  /** Systems scored in BOTH calls - the pairing. */
  n: number
  currentAvg: number | null
  priorAvg: number | null
  /** Of the paired systems, how many went up. */
  improved: number
  /**
   * Of the paired systems, how many went down. The average can hold still
   * while individual systems move in both directions, so a flat delta is not
   * evidence that nothing regressed.
   */
  declined: number
}

/** How each tier's membership changed between two calls. */
export type TierMovement = {
  /** Tier name -> net change in systems holding it. Absent means no change. */
  byTier: Record<string, number>
  /** Systems scored in BOTH calls - the pairing behind every number here. */
  n: number
}

/**
 * Net movement between tiers across two data calls.
 *
 * Paired, like {@link pairedDelta}: only systems tiered in both calls count,
 * so a system that simply did not participate this cycle cannot register as a
 * tier someone lost. A positive number means more systems hold that tier now.
 * @param {ScoreAggregate[]} aggregates - Rows covering both calls.
 * @param {Set<number>} systemIds - The OpDiv's system ids.
 * @param {number} currentCallId - The call being reported.
 * @param {number} priorCallId - The baseline call.
 * @returns {TierMovement} Per-tier net change and the paired count.
 */
export function pairedTierMovement(
  aggregates: ScoreAggregate[],
  systemIds: Set<number>,
  currentCallId: number,
  priorCallId: number
): TierMovement {
  const current = new Map<number, string>()
  const prior = new Map<number, string>()
  for (const row of aggregates) {
    if (!systemIds.has(row.fismasystemid)) continue
    if (!row.systemtier) continue
    if (row.datacallid === currentCallId)
      current.set(row.fismasystemid, row.systemtier)
    else if (row.datacallid === priorCallId)
      prior.set(row.fismasystemid, row.systemtier)
  }

  const byTier: Record<string, number> = {}
  let n = 0
  for (const [systemId, tier] of current) {
    const before = prior.get(systemId)
    if (before === undefined) continue
    n += 1
    if (before === tier) continue
    byTier[tier] = (byTier[tier] ?? 0) + 1
    byTier[before] = (byTier[before] ?? 0) - 1
  }
  return { byTier, n }
}

/**
 * Compares two data calls over the systems scored in both.
 *
 * Pairing matters: averaging each call over whatever happened to be scored in
 * it lets a changed system mix masquerade as movement. If three low-scoring
 * systems simply did not participate this cycle, an unpaired comparison would
 * report an improvement nobody earned.
 * @param {ScoreAggregate[]} aggregates - Rows covering both calls.
 * @param {Set<number>} systemIds - The OpDiv's system ids.
 * @param {number} currentCallId - The call being reported.
 * @param {number} priorCallId - The baseline call.
 * @returns {PairedDelta} The paired comparison.
 */
export function pairedDelta(
  aggregates: ScoreAggregate[],
  systemIds: Set<number>,
  currentCallId: number,
  priorCallId: number
): PairedDelta {
  const current = new Map<number, number>()
  const prior = new Map<number, number>()
  for (const row of aggregates) {
    if (!systemIds.has(row.fismasystemid)) continue
    if (!row.systemscore) continue
    if (row.datacallid === currentCallId)
      current.set(row.fismasystemid, row.systemscore)
    else if (row.datacallid === priorCallId)
      prior.set(row.fismasystemid, row.systemscore)
  }

  let currentSum = 0
  let priorSum = 0
  let n = 0
  let improved = 0
  let declined = 0
  for (const [systemId, score] of current) {
    const before = prior.get(systemId)
    if (before === undefined) continue
    currentSum += score
    priorSum += before
    n += 1
    const move = score - before
    if (move >= MIN_VISIBLE_SCORE_CHANGE) improved += 1
    else if (move <= -MIN_VISIBLE_SCORE_CHANGE) declined += 1
  }

  if (n === 0) {
    return {
      delta: null,
      n: 0,
      currentAvg: null,
      priorAvg: null,
      improved: 0,
      declined: 0,
    }
  }
  const currentAvg = currentSum / n
  const priorAvg = priorSum / n
  return {
    delta: currentAvg - priorAvg,
    n,
    currentAvg,
    priorAvg,
    improved,
    declined,
  }
}
