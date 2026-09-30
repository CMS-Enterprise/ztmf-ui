/**
 * Data for the system-scoped summary band.
 *
 * Thin by design: the shared figures come straight from the OpDiv dashboard's
 * orchestrator with no OpDiv filter, which for a system-scoped caller is
 * exactly their assigned systems - the backend narrows /scores/aggregate and
 * /scores/progress to AssignedFismaSystems before they reach the client. So
 * this hook only adds the four per-system derivations that page has no use for.
 *
 * @module views/MySystems/useMySystemsData
 */
import { useMemo } from 'react'
import { useContextProp } from '@/views/Title/Context'
import { useOpDivDashboardData } from '@/views/OpDivDashboard/useOpDivDashboardData'
import {
  movementBySystem,
  systemCompletionRows,
  systemsWithoutTarget,
  weakestPillarBySystem,
  type CompletionRow,
  type SystemMovement,
  type SystemWeakPillar,
} from './mySystemsAggregates'
import { usePillarAggregates, useDatacallAggregates } from '@/api/scores'
import type { OpDivSystemRow } from '@/views/OpDivDashboard/opdivAggregates'

/** Everything the band renders. */
export type MySystemsData = ReturnType<typeof useOpDivDashboardData> & {
  /** Per-system questionnaire progress, least complete first. */
  completionRows: CompletionRow[]
  /** Systems with no target maturity asserted. */
  noTarget: OpDivSystemRow[]
  /** Per-system movement against the prior call, regressions first. */
  movement: SystemMovement[]
  /** Each system's weakest pillar, worst first. */
  weakestPillars: SystemWeakPillar[]
}

/**
 * Assembles the band's data for the caller's own systems.
 * @param {boolean} [includeDetail] - Whether the detail panels are open. The
 *   pillar and full-history reads feed only those, and the band is collapsed
 *   by default, so fetching them regardless would make every ISSO pay for
 *   charts nobody has opened.
 * @returns {MySystemsData} The shared figures plus the per-system derivations.
 */
export function useMySystemsData(includeDetail = true): MySystemsData {
  const {
    fismaSystems,
    datacalls,
    latestDataCallId,
    opdivs,
    selectedDatacall,
  } = useContextProp()

  // Trend cadence follows the caller's OpDiv when they have exactly one, since
  // CMS runs quarterly calls and everyone else the annual cycle. Systems spread
  // across OpDivs have no single cadence, so they fall back to the annual one -
  // the same reasoning the aggregate view uses.
  const trendCode = useMemo(() => {
    const ids = new Set(
      fismaSystems
        .filter((s) => !s.decommissioned)
        .map((s) => s.opdiv_id)
        .filter((id): id is number => id != null)
    )
    if (ids.size !== 1) return null
    const [only] = [...ids]
    return opdivs.find((od) => od.opdiv_id === only)?.code ?? null
  }, [fismaSystems, opdivs])

  const data = useOpDivDashboardData(null, {
    trendOpDivCode: trendCode,
    includeDetail,
  })

  const latestDeadlinePassed = useMemo(() => {
    if (!latestDataCallId) return false
    const latest = datacalls.find((dc) => dc.datacallid === latestDataCallId)
    return latest ? new Date() > new Date(latest.deadline) : false
  }, [datacalls, latestDataCallId])

  const completionRows = useMemo(
    () =>
      systemCompletionRows(data.rows, latestDataCallId, latestDeadlinePassed),
    [data.rows, latestDataCallId, latestDeadlinePassed]
  )

  const noTarget = useMemo(() => systemsWithoutTarget(data.rows), [data.rows])

  // The same anchor + prior pair the delta uses, so movement and the hero's
  // comparison can never describe different calls.
  const anchorCallId =
    selectedDatacall?.datacallid ?? data.pillars.anchorCall?.datacallid
  const priorCallId = data.priorCall?.datacallid
  const { scoresPerCall: pairScores } = useDatacallAggregates(
    anchorCallId !== undefined && priorCallId !== undefined
      ? [anchorCallId, priorCallId]
      : []
  )
  const movement = useMemo(
    () =>
      movementBySystem(
        pairScores.flat(),
        data.rows.map((r) => r.system),
        anchorCallId,
        priorCallId
      ),
    [pairScores, data.rows, anchorCallId, priorCallId]
  )

  // Same key as the one inside useOpDivDashboardData, so this is a cache read
  // rather than a second request - and it stays disabled alongside it.
  const pillarQuery = usePillarAggregates(anchorCallId, {
    enabled: includeDetail,
  })
  const weakestPillars = useMemo(
    () =>
      weakestPillarBySystem(
        pillarQuery.data ?? [],
        data.rows.map((r) => r.system)
      ),
    [pillarQuery.data, data.rows]
  )

  return { ...data, completionRows, noTarget, movement, weakestPillars }
}
