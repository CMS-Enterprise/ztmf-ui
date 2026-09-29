/**
 * Pure derivations behind the system-scoped dashboard's action panels.
 *
 * Where the OpDiv page asks "how is this OpDiv doing" across a large estate,
 * an ISSO or ISSM holds a handful of systems and needs the per-system answer:
 * which of mine is behind, on what, and by how much. So every function here
 * returns one row per system rather than a rolled-up count - at N<=5 a
 * distribution is noise, while naming the system is the whole point.
 *
 * No React, no requests. The rules that matter (what counts as confirmed, when
 * a null target is "unasserted" rather than "failing") are pinned by unit tests
 * instead of by rendering.
 *
 * @module views/MySystems/mySystemsAggregates
 */
import {
  isRowCurrentCall,
  progressState,
  type OpDivSystemRow,
  type ProgressState,
} from '@/views/OpDivDashboard/opdivAggregates'
import { pillarScoresBySystem } from '@/views/OpDivDashboard/opdivPillars'
import { MIN_VISIBLE_SCORE_CHANGE } from '@/views/OpDivDashboard/opdivTrend'
import { pillarRank } from '@/utils/sortPillars'
import type { FismaSystemType, ScoreAggregate } from '@/types'

/** One system's questionnaire standing in the call it is displayed against. */
export type CompletionRow = {
  system: FismaSystemType
  state: ProgressState
  /** Applicable questions the call expects. */
  expected: number
  /** Questions carrying an answer at all, including carried-forward ones. */
  answered: number
  /** Questions genuinely touched this cycle. */
  updated: number
  /**
   * Answers sitting in the questionnaire that nobody has confirmed this cycle.
   *
   * This is the number the app has never shown anywhere, and it is the one that
   * matters: a new cycle is seeded with last cycle's answers, so a system can
   * read as fully answered and still register nothing (ztmf#659). Zero on a
   * closed call, where confirmations are no longer the measure.
   */
  unconfirmed: number
  /** True while the row is judged on confirmations rather than answers. */
  measuresConfirmations: boolean
  /** The call this row's progress was taken from, for questionnaire links. */
  datacallid?: number
}

/**
 * Per-system questionnaire progress, worst first.
 *
 * Systems the call expects nothing from are dropped rather than listed at 0/0 -
 * no function applies to their environment, so there is nothing to chase.
 * Classification goes through {@link progressState} so this panel can never
 * disagree with the table's Data Call Progress column.
 * @param {OpDivSystemRow[]} rows - The caller's rows.
 * @param {number} latestDataCallId - The newest call's id.
 * @param {boolean} latestDeadlinePassed - Whether that call has closed.
 * @returns {CompletionRow[]} One row per enrolled system, least done first.
 */
export function systemCompletionRows(
  rows: OpDivSystemRow[],
  latestDataCallId = 0,
  latestDeadlinePassed = false
): CompletionRow[] {
  const out: CompletionRow[] = []
  for (const row of rows) {
    const p = row.progress
    if (!p || p.questionsexpected <= 0) continue
    const current = isRowCurrentCall(
      row,
      latestDataCallId,
      latestDeadlinePassed
    )
    const answered = p.questionsanswered ?? 0
    // Only meaningful while confirmations are the measure. On a closed call
    // questionsupdated is 0 for everyone, so answered-minus-updated would
    // report the entire questionnaire as unconfirmed.
    const unconfirmed = current ? Math.max(0, answered - p.questionsupdated) : 0
    out.push({
      system: row.system,
      state: progressState(row, current),
      expected: p.questionsexpected,
      answered,
      updated: p.questionsupdated,
      unconfirmed,
      measuresConfirmations: current,
      datacallid: row.datacallid,
    })
  }
  // Least complete first: this is a worklist, so the system needing the most
  // attention belongs at the top. Ties break on acronym for a stable order.
  return out.sort(
    (a, b) =>
      doneShare(a) - doneShare(b) ||
      a.system.fismaacronym.localeCompare(b.system.fismaacronym)
  )
}

/** Share of a row's questionnaire that counts as done, 0-1. */
function doneShare(row: CompletionRow): number {
  const numerator = row.measuresConfirmations ? row.updated : row.answered
  return row.expected > 0 ? numerator / row.expected : 1
}

/**
 * Systems carrying no asserted target maturity.
 *
 * summarizeTargetGap counts these but does not name them, and the count alone
 * is useless to the person who can fix it: ISSOs and ISSMs are the tier that
 * sets a target, so on their own dashboard this is a worklist rather than a
 * statistic.
 *
 * A null target means "nobody has asserted one", never the 'Advanced' display
 * default the system detail card falls back to - treating that default as an
 * assertion would quietly mark every unassessed system as done.
 * @param {OpDivSystemRow[]} rows - The caller's rows.
 * @returns {OpDivSystemRow[]} Rows with no target, by acronym.
 */
export function systemsWithoutTarget(rows: OpDivSystemRow[]): OpDivSystemRow[] {
  return rows
    .filter((row) => !row.system.target_maturity_tier?.trim())
    .sort((a, b) => a.system.fismaacronym.localeCompare(b.system.fismaacronym))
}

/** Which way a system's score went between two calls. */
export type MovementDirection = 'gained' | 'lost' | 'held' | 'unpaired'

/** One system's movement between two calls. */
export type SystemMovement = {
  system: FismaSystemType
  /** Null when the system was not scored in the prior call. */
  from: number | null
  /** Null when the system is not scored in the current call. */
  to: number | null
  /** Signed, and null unless the system is scored in both. */
  delta: number | null
  direction: MovementDirection
}

/**
 * Every system's movement against the prior call, biggest drop first.
 *
 * Deliberately not biggestMovers: that keeps only the top few at each end and
 * drops unchanged systems entirely, which is the right shape for an estate of
 * hundreds and the wrong one for five. Here "nothing moved" is a real answer
 * and an unpaired system is worth naming rather than silently omitting.
 * @param {ScoreAggregate[]} scores - Rows covering both calls.
 * @param {FismaSystemType[]} systems - The caller's systems.
 * @param {number} [currentCallId] - The call being reported.
 * @param {number} [priorCallId] - The baseline call.
 * @returns {SystemMovement[]} One row per system, regressions first.
 */
export function movementBySystem(
  scores: ScoreAggregate[],
  systems: FismaSystemType[],
  currentCallId?: number,
  priorCallId?: number
): SystemMovement[] {
  const inScope = new Set(systems.map((s) => s.fismasystemid))
  const current = new Map<number, number>()
  const prior = new Map<number, number>()
  for (const row of scores) {
    if (!inScope.has(row.fismasystemid)) continue
    // Truthiness, not presence: scores are floored at 1.0, so a 0 is an absent
    // score coalesced upstream and must not read as a collapse to zero.
    if (!row.systemscore) continue
    if (row.datacallid === currentCallId)
      current.set(row.fismasystemid, row.systemscore)
    else if (row.datacallid === priorCallId)
      prior.set(row.fismasystemid, row.systemscore)
  }

  const rows: SystemMovement[] = systems.map((system) => {
    const to = current.get(system.fismasystemid) ?? null
    const from = prior.get(system.fismasystemid) ?? null
    if (to === null || from === null) {
      return { system, from, to, delta: null, direction: 'unpaired' }
    }
    const delta = to - from
    const direction: MovementDirection =
      Math.abs(delta) < MIN_VISIBLE_SCORE_CHANGE
        ? 'held'
        : delta > 0
          ? 'gained'
          : 'lost'
    return { system, from, to, delta, direction }
  })

  // Regressions first - the only entry here that asks for a response - then
  // gains, then held, then the systems there was nothing to compare.
  const rank: Record<MovementDirection, number> = {
    lost: 0,
    gained: 1,
    held: 2,
    unpaired: 3,
  }
  return rows.sort(
    (a, b) =>
      rank[a.direction] - rank[b.direction] ||
      Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0) ||
      a.system.fismaacronym.localeCompare(b.system.fismaacronym)
  )
}

/** One system's weakest pillar. */
export type SystemWeakPillar = {
  system: FismaSystemType
  pillar: string
  score: number
  /** How far below the system's own pillar average this sits. */
  belowOwnAverage: number
}

/**
 * The pillar dragging each system down.
 *
 * pillarExtremeCounts answers "which pillar is weakest for the most systems",
 * which is an estate-sized question. With five systems the useful form is the
 * other way round: for each system, name the pillar to work on next.
 *
 * Ties resolve to the first pillar in canonical order, matching
 * pillarExtremeCounts, so the two never disagree about which pillar is lowest.
 * @param {ScoreAggregate[]} aggregates - Rows from a pillar-bearing aggregate.
 * @param {FismaSystemType[]} systems - The caller's systems.
 * @returns {SystemWeakPillar[]} One row per system with pillar detail, worst first.
 */
export function weakestPillarBySystem(
  aggregates: ScoreAggregate[],
  systems: FismaSystemType[]
): SystemWeakPillar[] {
  const byId = new Map(systems.map((s) => [s.fismasystemid, s] as const))
  const names = new Map<number, string>()
  for (const row of aggregates) {
    for (const p of row.pillarscores ?? []) names.set(p.pillarid, p.pillar)
  }
  const ordered = [...names.entries()].sort(
    (a, b) => pillarRank(a[1]) - pillarRank(b[1]) || a[1].localeCompare(b[1])
  )

  const out: SystemWeakPillar[] = []
  for (const [systemId, scores] of pillarScoresBySystem(
    aggregates,
    new Set(byId.keys())
  )) {
    const system = byId.get(systemId)
    if (!system) continue
    let pillar: string | null = null
    let lowest = Infinity
    let sum = 0
    let n = 0
    // Canonical order, so a tie always resolves to the same pillar.
    for (const [pillarid, name] of ordered) {
      const score = scores.get(pillarid)
      if (score === undefined) continue
      sum += score
      n += 1
      if (score < lowest) {
        lowest = score
        pillar = name
      }
    }
    if (!pillar || n === 0) continue
    out.push({
      system,
      pillar,
      score: lowest,
      belowOwnAverage: sum / n - lowest,
    })
  }

  return out.sort(
    (a, b) =>
      a.score - b.score ||
      a.system.fismaacronym.localeCompare(b.system.fismaacronym)
  )
}
