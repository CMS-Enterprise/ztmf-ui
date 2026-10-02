/**
 * Pure derivations behind the OpDiv dashboard's tiles and panels.
 *
 * No React, no requests - every function here takes already-fetched data and
 * returns a plain value, so the rules that matter (which denominator, what an
 * absent score means, when a null is "unknown" rather than "no") are pinned by
 * unit tests instead of by rendering.
 *
 * Two invariants run through the whole module:
 *
 *  1. **The system universe is the caller's own systems list.** Score,
 *     progress and history rows are inner-joined against it and unmatched rows
 *     are discarded. /scores/aggregate carries no decommissioned filter, so it
 *     returns rows for systems the client has no record of - and a system the
 *     client cannot see cannot even be attributed to an OpDiv.
 *  2. **Tiers come from the API, never re-derived from the number.** See the
 *     note on tierForScore in @/utils/tierStyles.
 *
 * @module views/OpDivDashboard/opdivAggregates
 */
import type {
  FismaSystemType,
  ScoreProgress,
  ScoreTier,
  SystemScoreEntry,
} from '@/types'
import type { DashboardMaps } from '@/views/Home/aggregateScores'

/**
 * One system's row on the dashboard.
 *
 * `score` is undefined when the system has no aggregate row at all - it was
 * never enrolled in any active call. That is a different state from a system
 * that is enrolled but unanswered, which comes back scored at the floor with
 * tier "Not Assessed". Collapsing the two would report never-enrolled systems
 * as assessed-and-failing.
 */
export type OpDivSystemRow = {
  system: FismaSystemType
  score?: number
  tier?: ScoreTier
  progress?: ScoreProgress
  /** The call this row's score and progress were taken from. */
  datacallid?: number
}

/** Maturity tiers worst-to-best, for gap comparisons. */
export const TIER_RANK: Record<ScoreTier, number> = {
  'Not Assessed': 0,
  Traditional: 1,
  Initial: 2,
  Advanced: 3,
  Optimal: 4,
}

/** Bucket label for a system carrying no score row at all. */
export const NO_SCORE_LABEL = 'No score'

/**
 * Narrows the systems list to one OpDiv, excluding decommissioned rows.
 *
 * A null opdivId means every OpDiv the caller can see - the aggregate view.
 * That is deliberately "no filter" rather than "every visible OpDiv id":
 * /fismasystems is already narrowed server-side, so the unfiltered list is
 * exactly the caller's scope, and it keeps systems whose OpDiv is not a
 * switchable tenant (the HHS parent row) rather than dropping them from a
 * total that claims to cover everything.
 *
 * Decommissioned systems are excluded unconditionally, not by the global
 * "show decommissioned" toggle: that toggle swaps what /fismasystems returns,
 * so honoring it here would let flipping a switch on another page silently
 * change this OpDiv's headline score.
 * @param {FismaSystemType[]} systems - The caller's systems.
 * @param {number | null} opdivId - The OpDiv to scope to, or null for all.
 * @returns {FismaSystemType[]} Active systems in scope.
 */
export function scopeSystemsToOpDiv(
  systems: FismaSystemType[],
  opdivId: number | null
): FismaSystemType[] {
  return systems.filter(
    (s) => !s.decommissioned && (opdivId === null || s.opdiv_id === opdivId)
  )
}

/**
 * The set of system ids a page is scoped to, for inner-joining score rows.
 * @param {FismaSystemType[]} systems - The scoped systems.
 * @returns {Set<number>} Their ids.
 */
export function systemIdSet(systems: FismaSystemType[]): Set<number> {
  return new Set(systems.map((s) => s.fismasystemid))
}

/**
 * Joins scoped systems to their score and progress entries.
 * @param {FismaSystemType[]} systems - Systems already scoped to the OpDiv.
 * @param {DashboardMaps} maps - Output of buildDashboardMaps.
 * @returns {OpDivSystemRow[]} One row per system, in the input order.
 */
export function buildOpDivRows(
  systems: FismaSystemType[],
  maps: DashboardMaps
): OpDivSystemRow[] {
  return systems.map((system) => {
    const entry: SystemScoreEntry | undefined =
      maps.scoreMap[system.fismasystemid]
    return {
      system,
      // Truthiness, not presence: backend scores are floored at 1.0, so a 0
      // only comes from an absent or null score coalesced upstream and must
      // not count as scored.
      score: entry?.score ? entry.score : undefined,
      tier: entry?.tier,
      progress: maps.progressMap[system.fismasystemid],
      datacallid: maps.chosenCallMap[system.fismasystemid],
    }
  })
}

/** Headline counts for the KPI row. */
export type OpDivSummary = {
  systemCount: number
  scoredCount: number
  unscoredCount: number
  /** Null - not 0 - when nothing is scored, so no tier band is implied. */
  avgScore: number | null
  hvaCount: number
  hvaUnknownCount: number
  highFipsCount: number
  fipsUnknownCount: number
  optimalAdvancedCount: number
  highest: { score: number; acronym: string } | null
  lowest: { score: number; acronym: string } | null
}

/**
 * Headline figures for one OpDiv.
 *
 * The average divides by scored systems, not by all of them: a never-enrolled
 * system has no score to average, and counting it as 0 (or as the 1.0 floor)
 * would drag the OpDiv's headline number toward a value no system holds.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {OpDivSummary} The summary.
 */
export function summarizeOpDiv(rows: OpDivSystemRow[]): OpDivSummary {
  let scoreSum = 0
  let scoredCount = 0
  let hvaCount = 0
  let hvaUnknownCount = 0
  let highFipsCount = 0
  let fipsUnknownCount = 0
  let optimalAdvancedCount = 0
  let highest: { score: number; acronym: string } | null = null
  let lowest: { score: number; acronym: string } | null = null

  for (const row of rows) {
    // Tri-state booleans: null is "unknown", never "no". Reporting an
    // unrecorded HVA flag as a non-HVA invents a fact about the system.
    if (row.system.hva === true) hvaCount += 1
    else if (row.system.hva == null) hvaUnknownCount += 1

    if (row.system.fips === 'High') highFipsCount += 1
    else if (row.system.fips == null) fipsUnknownCount += 1

    if (row.tier === 'Optimal' || row.tier === 'Advanced')
      optimalAdvancedCount += 1

    if (row.score === undefined) continue
    scoreSum += row.score
    scoredCount += 1
    if (!highest || row.score > highest.score)
      highest = { score: row.score, acronym: row.system.fismaacronym }
    if (!lowest || row.score < lowest.score)
      lowest = { score: row.score, acronym: row.system.fismaacronym }
  }

  return {
    systemCount: rows.length,
    scoredCount,
    unscoredCount: rows.length - scoredCount,
    avgScore: scoredCount > 0 ? scoreSum / scoredCount : null,
    hvaCount,
    hvaUnknownCount,
    highFipsCount,
    fipsUnknownCount,
    optimalAdvancedCount,
    highest,
    lowest,
  }
}

/**
 * A system's standing in the data call, mirroring the Data Call Progress
 * column's states so the summary and the table can never disagree.
 */
export type ProgressState =
  | 'complete'
  | 'partial'
  | 'awaiting-confirmation'
  | 'not-started'
  | 'not-applicable'
  | 'unknown'

/**
 * Whether the call a row is displayed against is the open one.
 *
 * Mirrors FismaTable's isRowCurrentCall: a row falls back to "current" when
 * the latest call or the row's own call is unknown, and nothing is current
 * once the latest deadline has passed.
 * @param {OpDivSystemRow} row - The row.
 * @param {number} latestDataCallId - The newest call's id.
 * @param {boolean} latestDeadlinePassed - Whether that call has closed.
 * @returns {boolean} True when the row is on the open call.
 */
export function isRowCurrentCall(
  row: OpDivSystemRow,
  latestDataCallId: number,
  latestDeadlinePassed: boolean
): boolean {
  if (!latestDataCallId || row.datacallid == null) return true
  return row.datacallid === latestDataCallId && !latestDeadlinePassed
}

/**
 * Classifies a row's data-call progress.
 *
 * The open call is judged on answers CONFIRMED this cycle, not on answers
 * present. A new cycle is seeded with the previous cycle's answers, so a
 * system nobody has touched still reports a full `questionsanswered` while
 * reading 0/40 in the table - counting that as complete claimed work that had
 * not happened. Zero confirmations is zero progress, whether or not carried
 * answers are sitting there awaiting review.
 *
 * A closed call is the opposite: `questionsupdated` is 0 for everyone once the
 * cycle ends, so it is judged on answers instead (ztmf#437/#537).
 * @param {OpDivSystemRow} row - The row.
 * @param {boolean} isCurrentCall - Whether the row is on the open call.
 * @returns {ProgressState} The row's state.
 */
export function progressState(
  row: OpDivSystemRow,
  isCurrentCall: boolean
): ProgressState {
  const p = row.progress
  if (!p) return 'unknown'
  // 0/0: no functions apply to this system's environment. Not a laggard -
  // there is nothing to chase.
  if (p.questionsexpected <= 0) return 'not-applicable'

  if (!isCurrentCall) {
    const answered = p.questionsanswered ?? 0
    if (answered >= p.questionsexpected) return 'complete'
    return answered > 0 ? 'partial' : 'not-started'
  }

  if (p.questionsupdated > 0) {
    return p.questionsupdated >= p.questionsexpected ? 'complete' : 'partial'
  }
  // Both remaining states are zero progress this cycle. They are kept apart
  // only so the UI can say which kind - a blanket "not started" read as data
  // loss to ISSOs who had just reviewed everything.
  return (p.questionsanswered ?? 0) > 0
    ? 'awaiting-confirmation'
    : 'not-started'
}

/** States that represent no progress at all in the current cycle. */
const NO_PROGRESS_STATES: ProgressState[] = [
  'awaiting-confirmation',
  'not-started',
]

/** Data-call completion across the OpDiv. */
export type CompletionSummary = {
  /** Systems the call actually expects questions from. */
  systemsInCall: number
  /** Systems fully done - confirmed this cycle, or answered on a closed call. */
  systemsComplete: number
  /** Systems with zero progress: never started, plus awaiting confirmation. */
  notStarted: number
  /** Of those, the ones carrying prior answers nobody has confirmed. */
  awaitingConfirmation: number
  questionsExpected: number
  questionsAnswered: number
  questionsUpdated: number
  /**
   * Share of the call actually done: confirmations on an open call, answers on
   * a closed one. Null when the call expects nothing, so no false 0% or 100%.
   */
  progressPct: number | null
  /** True when the figures describe confirmations rather than answers. */
  measuresConfirmations: boolean
  /** Most recent edit across the OpDiv, ISO string, or null. */
  lastUpdatedAt: string | null
}

/**
 * Questionnaire progress rolled up over the OpDiv.
 *
 * The denominator is systems the call expects questions from, not every system
 * in the OpDiv: pairing a done count with an all-systems denominator reads as
 * a much larger backlog than exists.
 *
 * On an open call this measures CONFIRMATIONS, not answers - see
 * {@link progressState} for why a carried-forward questionnaire is not done.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @param {number} latestDataCallId - The newest call's id.
 * @param {boolean} latestDeadlinePassed - Whether that call has closed.
 * @returns {CompletionSummary} The completion summary.
 */
export function summarizeCompletion(
  rows: OpDivSystemRow[],
  latestDataCallId = 0,
  latestDeadlinePassed = false
): CompletionSummary {
  let systemsInCall = 0
  let systemsComplete = 0
  let notStarted = 0
  let awaitingConfirmation = 0
  let questionsExpected = 0
  let questionsAnswered = 0
  let questionsUpdated = 0
  let currentCallRows = 0
  let lastUpdatedMs = -1
  let lastUpdatedAt: string | null = null

  for (const row of rows) {
    const p = row.progress
    if (!p || p.questionsexpected <= 0) continue
    const current = isRowCurrentCall(
      row,
      latestDataCallId,
      latestDeadlinePassed
    )
    if (current) currentCallRows += 1
    const state = progressState(row, current)

    systemsInCall += 1
    questionsExpected += p.questionsexpected
    questionsAnswered += p.questionsanswered ?? 0
    questionsUpdated += p.questionsupdated
    if (state === 'complete') systemsComplete += 1
    if (NO_PROGRESS_STATES.includes(state)) notStarted += 1
    if (state === 'awaiting-confirmation') awaitingConfirmation += 1

    if (p.lastupdatedat) {
      const t = new Date(p.lastupdatedat).getTime()
      if (!Number.isNaN(t) && t > lastUpdatedMs) {
        lastUpdatedMs = t
        lastUpdatedAt = p.lastupdatedat
      }
    }
  }

  // The percentage follows whichever measure the rows were judged on, so it
  // cannot report 90% answered beside a system list that is entirely
  // unconfirmed.
  const measuresConfirmations = currentCallRows > 0
  const numerator = measuresConfirmations ? questionsUpdated : questionsAnswered

  return {
    systemsInCall,
    systemsComplete,
    notStarted,
    awaitingConfirmation,
    questionsExpected,
    questionsAnswered,
    questionsUpdated,
    progressPct:
      questionsExpected > 0 ? (numerator / questionsExpected) * 100 : null,
    measuresConfirmations,
    lastUpdatedAt,
  }
}

/**
 * Compares a system's actual tier against its asserted target.
 * @param {ScoreTier} [actual] - The scored tier, if any.
 * @param {string | null} [target] - The asserted target tier, if any.
 * @returns {boolean | null} True/false, or null when the answer is unknowable.
 */
export function meetsTarget(
  actual: ScoreTier | undefined,
  target: string | null | undefined
): boolean | null {
  if (!target || !actual) return null
  const targetRank = TIER_RANK[target as ScoreTier]
  if (targetRank === undefined) return null
  return TIER_RANK[actual] >= targetRank
}

/** One system falling short of its asserted target. */
export type TargetShortfall = {
  system: FismaSystemType
  actual: ScoreTier
  target: string
  /** Tier steps short of target; always >= 1. */
  gap: number
}

/** Target-maturity coverage across the OpDiv. */
export type TargetGap = {
  atOrAbove: number
  below: number
  /** Systems with no asserted target - not a failure, an unanswered question. */
  noTarget: number
  /** Systems with a target but no score to judge it against. */
  unscored: number
  /** Shortfalls, widest gap first. */
  shortfalls: TargetShortfall[]
}

/**
 * Target maturity vs actual across the OpDiv.
 *
 * A null `target_maturity_tier` counts as "no target asserted", never as the
 * 'Advanced' display default used on the system detail card. That default is a
 * presentation choice; baking it in here would invent an asserted target for
 * every system nobody has assessed.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {TargetGap} The gap summary.
 */
export function summarizeTargetGap(rows: OpDivSystemRow[]): TargetGap {
  let atOrAbove = 0
  let below = 0
  let noTarget = 0
  let unscored = 0
  const shortfalls: TargetShortfall[] = []

  for (const row of rows) {
    const target = row.system.target_maturity_tier
    if (!target || TIER_RANK[target as ScoreTier] === undefined) {
      noTarget += 1
      continue
    }
    if (!row.tier) {
      unscored += 1
      continue
    }
    const gap = TIER_RANK[target as ScoreTier] - TIER_RANK[row.tier]
    if (gap <= 0) {
      atOrAbove += 1
      continue
    }
    below += 1
    shortfalls.push({ system: row.system, actual: row.tier, target, gap })
  }

  shortfalls.sort(
    (a, b) =>
      b.gap - a.gap ||
      a.system.fismaacronym.localeCompare(b.system.fismaacronym)
  )
  return { atOrAbove, below, noTarget, unscored, shortfalls }
}

/** Why a system counts as high impact. Both can apply. */
export type RiskReason = 'HVA' | 'High FIPS'

/** The tier a high-impact system is expected to clear. */
export const RISK_TIER_FLOOR: ScoreTier = 'Advanced'

/** One high-impact system and where its maturity sits. */
export type RiskRow = {
  system: FismaSystemType
  reasons: RiskReason[]
  /** Undefined when the system carries no score row at all. */
  score?: number
  tier?: ScoreTier
}

/** High-impact systems ranked against the maturity floor. */
export type RiskSummary = {
  /** Systems flagged HVA or High FIPS. */
  highImpact: number
  /** High impact, scored, and below the floor - worst first. */
  belowFloor: RiskRow[]
  /** High impact and clearing the floor. */
  atOrAboveFloor: number
  /** High impact with no score row - never enrolled, not assessed-and-failing. */
  unscored: number
  /** Systems with neither flag recorded, so their impact is unknown. */
  unknownImpact: number
}

/**
 * High-impact systems that have not reached the maturity floor.
 *
 * The page's other figures rank every system alike; this one asks the question
 * a reader actually acts on - of the systems where a weakness costs the most,
 * which are weakest. Impact is the two flags the catalog records: HVA and a
 * High FIPS impact level.
 *
 * Tri-state nulls stay unknown, never "no": a system with neither flag recorded
 * is counted apart rather than quietly treated as low impact, because that
 * would shrink the risk list by assuming facts nobody has entered.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {RiskSummary} The risk summary.
 */
export function summarizeRisk(rows: OpDivSystemRow[]): RiskSummary {
  const floor = TIER_RANK[RISK_TIER_FLOOR]
  const belowFloor: RiskRow[] = []
  let highImpact = 0
  let atOrAboveFloor = 0
  let unscored = 0
  let unknownImpact = 0

  for (const row of rows) {
    const reasons: RiskReason[] = []
    if (row.system.hva === true) reasons.push('HVA')
    if (row.system.fips === 'High') reasons.push('High FIPS')
    if (reasons.length === 0) {
      if (row.system.hva == null && row.system.fips == null) unknownImpact += 1
      continue
    }

    highImpact += 1
    if (!row.tier) {
      unscored += 1
      continue
    }
    if (TIER_RANK[row.tier] >= floor) {
      atOrAboveFloor += 1
      continue
    }
    belowFloor.push({
      system: row.system,
      reasons,
      score: row.score,
      tier: row.tier,
    })
  }

  // Weakest first, and a Not Assessed system (rank 0) sorts above a scored
  // Traditional one - it is the bigger unknown, not the smaller problem.
  belowFloor.sort(
    (a, b) =>
      TIER_RANK[a.tier as ScoreTier] - TIER_RANK[b.tier as ScoreTier] ||
      (a.score ?? 0) - (b.score ?? 0) ||
      a.system.fismaacronym.localeCompare(b.system.fismaacronym)
  )
  return { highImpact, belowFloor, atOrAboveFloor, unscored, unknownImpact }
}

/** One bar in the score-by-system chart. */
export type SystemScoreBar = {
  fismasystemid: number
  acronym: string
  score: number
  tier: ScoreTier
}

/**
 * Scored systems, highest first, for the score-by-system chart. Unscored
 * systems are omitted rather than plotted at zero - a bar at the floor reads
 * as a measured failure.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {SystemScoreBar[]} Scored systems, descending.
 */
export function scoreBySystem(rows: OpDivSystemRow[]): SystemScoreBar[] {
  return rows
    .filter(
      (r): r is OpDivSystemRow & { score: number; tier: ScoreTier } =>
        r.score !== undefined && r.tier !== undefined
    )
    .map((r) => ({
      fismasystemid: r.system.fismasystemid,
      acronym: r.system.fismaacronym,
      score: r.score,
      tier: r.tier,
    }))
    .sort((a, b) => b.score - a.score || a.acronym.localeCompare(b.acronym))
}

/** Below this many systems the whole list fits, so nothing is hidden. */
export const EXTREMES_THRESHOLD = 18
/** How many to keep at each end once the list is split. */
export const EXTREMES_PER_END = 8

/** Min, median and max of a scored set. */
export type ScoreSpread = { min: number; median: number; max: number }

/**
 * The spread of a scored set.
 *
 * The median earns its place next to the headline average: a long tail of
 * systems sitting at the 1.00 floor drags a mean somewhere no real system is,
 * and the two numbers diverging is exactly the signal that the OpDiv is split
 * rather than uniformly mid-range.
 * @param {SystemScoreBar[]} bars - Scored systems, in any order.
 * @returns {ScoreSpread | null} The spread, or null when nothing is scored.
 */
export function scoreSpread(bars: SystemScoreBar[]): ScoreSpread | null {
  if (bars.length === 0) return null
  const sorted = [...bars].map((b) => b.score).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return {
    min: sorted[0],
    // Even counts average the two middle values rather than picking one.
    median:
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid],
    max: sorted[sorted.length - 1],
  }
}

/** A score list reduced to its two ends. */
export type ScoreExtremes = {
  /** Highest scorers, descending. */
  top: SystemScoreBar[]
  /** Lowest scorers, descending - so the whole panel reads as one ranking. */
  bottom: SystemScoreBar[]
  /** Systems between the two ends, omitted from the panel. */
  hiddenCount: number
}

/**
 * Reduces a ranked score list to its extremes.
 *
 * A bar per system is unbounded: an OpDiv with hundreds of them grows the card
 * until the surrounding row is mostly empty space, and three hundred bars are
 * unreadable regardless. The ends are what the figure is actually good for -
 * who leads and who needs attention - and the full enumeration is already the
 * systems table's job, so the middle is dropped rather than paginated. Under
 * the threshold nothing is hidden, because there is nothing to gain by it.
 * @param {SystemScoreBar[]} bars - Scored systems, already sorted descending.
 * @returns {ScoreExtremes} The two ends plus the omitted count.
 */
export function splitExtremes(bars: SystemScoreBar[]): ScoreExtremes {
  if (bars.length <= EXTREMES_THRESHOLD) {
    return { top: bars, bottom: [], hiddenCount: 0 }
  }
  return {
    top: bars.slice(0, EXTREMES_PER_END),
    bottom: bars.slice(-EXTREMES_PER_END),
    hiddenCount: bars.length - EXTREMES_PER_END * 2,
  }
}

/** A system with no progress, and which kind of nothing it is. */
export type NoProgressRow = {
  row: OpDivSystemRow
  /** True when prior answers are carried forward but unconfirmed. */
  awaitingConfirmation: boolean
}

/**
 * Systems enrolled in the call that have made no progress at all.
 *
 * Covers both zero-progress states: never answered, and carried forward but
 * unconfirmed. Both are outstanding work - a questionnaire nobody has
 * confirmed this cycle is not underway, however many prior answers sit in it -
 * and both render as warning laggards in the systems table, so counting one
 * and not the other made the summary contradict the rows beneath it.
 *
 * Ordered by acronym so the list is stable between renders rather than
 * reshuffling as scores land.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @param {number} latestDataCallId - The newest call's id.
 * @param {boolean} latestDeadlinePassed - Whether that call has closed.
 * @returns {NoProgressRow[]} Enrolled systems with no progress.
 */
export function notStartedSystems(
  rows: OpDivSystemRow[],
  latestDataCallId = 0,
  latestDeadlinePassed = false
): NoProgressRow[] {
  return rows
    .map((row) => ({
      row,
      state: progressState(
        row,
        isRowCurrentCall(row, latestDataCallId, latestDeadlinePassed)
      ),
    }))
    .filter((entry) => NO_PROGRESS_STATES.includes(entry.state))
    .map((entry) => ({
      row: entry.row,
      awaitingConfirmation: entry.state === 'awaiting-confirmation',
    }))
    .sort((a, b) =>
      a.row.system.fismaacronym.localeCompare(b.row.system.fismaacronym)
    )
}

/** Systems with no ISSO email recorded - a coverage gap, not a score gap. */
export function systemsMissingIsso(rows: OpDivSystemRow[]): FismaSystemType[] {
  return rows.filter((r) => !r.system.issoemail?.trim()).map((r) => r.system)
}

/** Systems with no data-call point of contact recorded. */
export function systemsMissingContact(
  rows: OpDivSystemRow[]
): FismaSystemType[] {
  return rows
    .filter((r) => !r.system.datacallcontact?.trim())
    .map((r) => r.system)
}
