/**
 * The single React orchestrator for the OpDiv dashboard.
 *
 * Reads shared state from Outlet context, issues the score queries, and feeds
 * the pure modules. No axios, no useEffect, no AbortController - the query
 * layer owns cancellation (see docs/data-fetching.md).
 *
 * @module views/OpDivDashboard/useOpDivDashboardData
 */
import { useMemo, useState } from 'react'
import { daysUntil } from '@/utils/dates'
import {
  useDatacallAggregates,
  useDatacallProgress,
  usePillarAggregates,
  useScoreHistory,
} from '@/utils/scores'
import {
  buildDashboardMaps,
  type DashboardMaps,
} from '@/views/Home/aggregateScores'
import { useContextProp } from '../Title/Context'
import {
  buildOpDivRows,
  notStartedSystems,
  scopeSystemsToOpDiv,
  scoreBySystem,
  summarizeCompletion,
  summarizeOpDiv,
  summarizeRisk,
  summarizeTargetGap,
  systemIdSet,
  systemsMissingContact,
  systemsMissingIsso,
  type OpDivSystemRow,
} from './opdivAggregates'
import {
  breakdownByFips,
  breakdownByHosting,
  breakdownByOperatingModel,
  breakdownByServiceModel,
  breakdownByStage,
} from './opdivBreakdowns'
import { averageByOpDiv } from './opdivByOpDiv'
import { averageByPillar, pillarExtremeCounts } from './opdivPillars'
import {
  biggestMovers,
  buildTrendSeries,
  pairedDelta,
  pairedTierMovement,
  selectPriorCall,
  selectTrendCalls,
  tierDistribution,
} from './opdivTrend'
import type { datacall } from '@/types'

/** Everything the dashboard renders. */
export type OpDivDashboardData = {
  rows: OpDivSystemRow[]
  /** The merged per-system maps, passed straight through to FismaTable. */
  maps: DashboardMaps
  summary: ReturnType<typeof summarizeOpDiv>
  completion: ReturnType<typeof summarizeCompletion>
  targetGap: ReturnType<typeof summarizeTargetGap>
  /** High-impact systems below the maturity floor - the chase list by risk. */
  risk: ReturnType<typeof summarizeRisk>
  bySystem: ReturnType<typeof scoreBySystem>
  /** Per-OpDiv averages, populated only in the aggregate view. */
  byOpDiv: ReturnType<typeof averageByOpDiv>
  /** Enrolled systems with no progress yet - the chase list. */
  notStarted: ReturnType<typeof notStartedSystems>
  breakdowns: {
    fips: ReturnType<typeof breakdownByFips>
    hosting: ReturnType<typeof breakdownByHosting>
    operatingModel: ReturnType<typeof breakdownByOperatingModel>
    serviceModel: ReturnType<typeof breakdownByServiceModel>
    stage: ReturnType<typeof breakdownByStage>
  }
  coverage: {
    missingIsso: ReturnType<typeof systemsMissingIsso>
    missingContact: ReturnType<typeof systemsMissingContact>
  }
  pillars: {
    /** The single call the pillar chart describes. */
    anchorCall: datacall | null
    averages: ReturnType<typeof averageByPillar>
    /** Which pillar is weakest/strongest for the most systems. */
    extremes: ReturnType<typeof pillarExtremeCounts>
    isPending: boolean
  }
  /** Net tier movement vs the prior call, paired by system. */
  tierMovement: ReturnType<typeof pairedTierMovement>
  delta: ReturnType<typeof pairedDelta>
  /** The baseline call the delta compares against. */
  priorCall: datacall | null
  /** Whole days until the anchor call's deadline; negative once it passes. */
  daysRemaining: number | null
  trend: {
    points: ReturnType<typeof buildTrendSeries>
    isPending: boolean
    isError: boolean
    /** Names the data-call cadence this series follows. */
    cadenceNote?: string
    /** The point the detail below the chart describes. */
    selectedCallId: number | null
    selectCall: (datacallId: number) => void
    /** How the selected call's systems were spread across tiers. */
    tiers: ReturnType<typeof tierDistribution>
    /** The systems behind the step into the selected call. */
    movers: ReturnType<typeof biggestMovers>
  }
  /** True until the blocking systems + score/progress pair has settled. */
  isPending: boolean
  isError: boolean
}

/** Optional adjustments for callers other than the OpDiv dashboard itself. */
export type OpDivDashboardOptions = {
  /**
   * Overrides the cadence the trend follows. The unfiltered scope normally
   * means "the aggregate", which runs the annual cycle - but it also covers a
   * system-scoped caller whose systems all sit in one OpDiv, and that caller
   * should follow that OpDiv's cadence. Omit to derive it from `opdivId`.
   */
  trendOpDivCode?: string | null
  /** Whether to fetch the anchor and prior pillar aggregates, default true. */
  includePillars?: boolean
  /** Whether to fetch the full score history behind the trend, default true. */
  includeHistory?: boolean
}

/**
 * Assembles the dashboard's data for one OpDiv, or for all of them.
 * @param {number | null} opdivId - The OpDiv being viewed, or null to
 *   aggregate every OpDiv the caller can see.
 * @param {OpDivDashboardOptions} [options] - Cadence override and query gates.
 * @returns {OpDivDashboardData} Rows, summaries, breakdowns and load state.
 */
export function useOpDivDashboardData(
  opdivId: number | null,
  options: OpDivDashboardOptions = {}
): OpDivDashboardData {
  const {
    trendOpDivCode,
    includePillars = true,
    includeHistory = true,
  } = options
  const {
    fismaSystems,
    fismaSystemsLoaded,
    datacalls,
    activeDatacallIds,
    selectedDatacall,
    latestDataCallId,
    opdivs,
  } = useContextProp()

  // Which point on the trend the detail below it describes. Click-driven, not
  // hover-driven: selecting fires a pillar request for that call, and firing
  // one per pixel of mouse travel would be absurd.
  const [selectedTrendCallId, setSelectedTrendCallId] = useState<number | null>(
    null
  )

  const systems = useMemo(
    () => scopeSystemsToOpDiv(fismaSystems, opdivId),
    [fismaSystems, opdivId]
  )
  const systemIds = useMemo(() => systemIdSet(systems), [systems])

  // R1 + R2: the blocking pair, keyed identically to the main dashboard's
  // requests so the two share cache entries rather than duplicating them.
  const {
    scoresPerCall,
    isPending: scoresPending,
    isError: scoresError,
  } = useDatacallAggregates(activeDatacallIds)
  const {
    progressPerCall,
    isPending: progressPending,
    isError: progressError,
  } = useDatacallProgress(activeDatacallIds)

  const maps = useMemo(
    () => buildDashboardMaps(activeDatacallIds, scoresPerCall, progressPerCall),
    [activeDatacallIds, scoresPerCall, progressPerCall]
  )

  const rows = useMemo(() => buildOpDivRows(systems, maps), [systems, maps])

  // Mirrors FismaTable: once the newest call's deadline passes nothing is
  // "current", so every row is judged on answers rather than confirmations.
  const latestDeadlinePassed = useMemo(() => {
    if (!latestDataCallId) return false
    const latest = datacalls.find((dc) => dc.datacallid === latestDataCallId)
    return latest ? new Date() > new Date(latest.deadline) : false
  }, [datacalls, latestDataCallId])

  // The pillar chart describes ONE call. Requesting pillars for every active
  // call would multiply the payload by the pillar count for a chart that can
  // only show one profile; activeDatacallIds is newest-deadline-first.
  const anchorCallId = selectedDatacall?.datacallid ?? activeDatacallIds[0]
  const anchorCall = useMemo(
    () => datacalls.find((dc) => dc.datacallid === anchorCallId) ?? null,
    [datacalls, anchorCallId]
  )
  const pillarQuery = usePillarAggregates(anchorCallId, {
    enabled: includePillars,
  })

  // Each OpDiv's trend follows its own data-call cadence; mixing the two is
  // what made the line oscillate. See selectTrendCalls.
  const opdivCode = useMemo(
    () =>
      trendOpDivCode !== undefined
        ? trendOpDivCode
        : opdivId === null
          ? null
          : opdivs.find((od) => od.opdiv_id === opdivId)?.code ?? null,
    [opdivs, opdivId, trendOpDivCode]
  )
  const trendCalls = useMemo(
    () => selectTrendCalls(datacalls, opdivCode),
    [datacalls, opdivCode]
  )

  // The prior call in the scope's own cadence: the next call by deadline can
  // belong to the other cadence and carry none of this OpDiv's systems.
  const priorCall = useMemo(
    () => selectPriorCall(datacalls, opdivCode, anchorCall),
    [datacalls, opdivCode, anchorCall]
  )

  // Anchor + prior together. The anchor is already in activeDatacallIds, so it
  // resolves from cache and only the prior call is a new request.
  const deltaIds = useMemo(
    () =>
      anchorCallId !== undefined && priorCall
        ? [anchorCallId, priorCall.datacallid]
        : [],
    [anchorCallId, priorCall]
  )
  const { scoresPerCall: deltaScores } = useDatacallAggregates(deltaIds)

  // Pillars for the baseline call, so each bar can carry its own movement.
  // One extra request, cached and off the blocking path - the bars render from
  // the anchor call and gain their deltas when this settles.
  const priorPillarQuery = usePillarAggregates(priorCall?.datacallid, {
    enabled: includePillars,
  })
  const pillarAverages = useMemo(
    () =>
      averageByPillar(
        pillarQuery.data ?? [],
        systemIds,
        priorPillarQuery.data ?? []
      ),
    [pillarQuery.data, priorPillarQuery.data, systemIds]
  )
  const pillarExtremes = useMemo(
    () => pillarExtremeCounts(pillarQuery.data ?? [], systemIds),
    [pillarQuery.data, systemIds]
  )
  const delta = useMemo(() => {
    if (anchorCallId === undefined || !priorCall)
      return {
        delta: null,
        n: 0,
        currentAvg: null,
        priorAvg: null,
        improved: 0,
        declined: 0,
      }
    return pairedDelta(
      deltaScores.flat(),
      systemIds,
      anchorCallId,
      priorCall.datacallid
    )
  }, [deltaScores, systemIds, anchorCallId, priorCall])

  const tierMovement = useMemo(() => {
    if (anchorCallId === undefined || !priorCall) return { byTier: {}, n: 0 }
    return pairedTierMovement(
      deltaScores.flat(),
      systemIds,
      anchorCallId,
      priorCall.datacallid
    )
  }, [deltaScores, systemIds, anchorCallId, priorCall])

  // Fetched with the page rather than behind a button: measured at ~600ms and
  // ~730KB against the current dataset, which is worth paying up front for a
  // panel people actually read. It is still its own query, so the rest of the
  // page renders while it lands - it was never on the blocking path.
  const historyQuery = useScoreHistory({ enabled: includeHistory })
  const trendPoints = useMemo(
    () => buildTrendSeries(historyQuery.data ?? [], systemIds, trendCalls),
    [historyQuery.data, systemIds, trendCalls]
  )

  // Defaults to the newest point so the detail strip is never blank, and
  // falls back there if a pinned call drops out of the series (switching
  // OpDiv changes the cadence, so the previous selection may not exist).
  const selectedTrendIndex = useMemo(() => {
    const found = trendPoints.findIndex(
      (p) => p.datacallid === selectedTrendCallId
    )
    return found >= 0 ? found : trendPoints.length - 1
  }, [trendPoints, selectedTrendCallId])
  const selectedTrendCall = trendPoints[selectedTrendIndex] ?? null
  // The call before it IN THE PLOTTED SERIES, not in the full list: each OpDiv
  // follows one cadence, so the step the chart draws is the step to describe.
  const previousTrendCall = trendPoints[selectedTrendIndex - 1] ?? null

  // Both of these come out of the history response already in hand, so opening
  // a point costs nothing. They also say something the panels above do not:
  // the spread behind the average, and which systems produced the step.
  const trendTiers = useMemo(
    () =>
      tierDistribution(
        historyQuery.data ?? [],
        systemIds,
        selectedTrendCall?.datacallid
      ),
    [historyQuery.data, systemIds, selectedTrendCall]
  )
  const trendMovers = useMemo(
    () =>
      biggestMovers(
        historyQuery.data ?? [],
        systems,
        selectedTrendCall?.datacallid,
        previousTrendCall?.datacallid
      ),
    [historyQuery.data, systems, selectedTrendCall, previousTrendCall]
  )

  const summary = useMemo(() => summarizeOpDiv(rows), [rows])
  const completion = useMemo(
    () => summarizeCompletion(rows, latestDataCallId, latestDeadlinePassed),
    [rows, latestDataCallId, latestDeadlinePassed]
  )
  const targetGap = useMemo(() => summarizeTargetGap(rows), [rows])
  const risk = useMemo(() => summarizeRisk(rows), [rows])
  const bySystem = useMemo(() => scoreBySystem(rows), [rows])
  // Only meaningful when the page spans more than one OpDiv.
  const byOpDiv = useMemo(
    () => (opdivId === null ? averageByOpDiv(rows, opdivs) : []),
    [rows, opdivs, opdivId]
  )
  const notStarted = useMemo(
    () => notStartedSystems(rows, latestDataCallId, latestDeadlinePassed),
    [rows, latestDataCallId, latestDeadlinePassed]
  )
  const breakdowns = useMemo(
    () => ({
      fips: breakdownByFips(rows),
      hosting: breakdownByHosting(rows),
      operatingModel: breakdownByOperatingModel(rows),
      serviceModel: breakdownByServiceModel(rows),
      stage: breakdownByStage(rows),
    }),
    [rows]
  )
  const coverage = useMemo(
    () => ({
      missingIsso: systemsMissingIsso(rows),
      missingContact: systemsMissingContact(rows),
    }),
    [rows]
  )

  return {
    rows,
    maps,
    summary,
    completion,
    targetGap,
    risk,
    bySystem,
    byOpDiv,
    notStarted,
    breakdowns,
    coverage,
    pillars: {
      anchorCall,
      averages: pillarAverages,
      extremes: pillarExtremes,
      isPending: pillarQuery.isPending,
    },
    tierMovement,
    delta,
    priorCall,
    // What makes an outstanding questionnaire urgent rather than merely open.
    daysRemaining: daysUntil(anchorCall?.deadline),
    trend: {
      points: trendPoints,
      isPending: historyQuery.isPending,
      isError: historyQuery.isError,
      cadenceNote:
        opdivCode === 'CMS'
          ? 'Quarterly CMS calls, plus the shared annual cycle'
          : 'Annual ZTM calls',
      selectedCallId: selectedTrendCall?.datacallid ?? null,
      selectCall: setSelectedTrendCallId,
      tiers: trendTiers,
      movers: trendMovers,
    },
    // activeDatacallIds is [] while Title is still fetching /datacalls, which
    // is not "loaded and empty" - hold the skeleton through that window too.
    isPending:
      !fismaSystemsLoaded ||
      activeDatacallIds.length === 0 ||
      scoresPending ||
      progressPending,
    isError: scoresError || progressError,
  }
}
