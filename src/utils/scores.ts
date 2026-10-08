/**
 * Query hooks for the score endpoints.
 *
 * Keyed so requests that other pages already make (per-datacall aggregate and
 * progress) are cache hits rather than duplicates. See docs/data-fetching.md.
 *
 * @module utils/scores
 */
import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { type QueryHookOptions } from '@/queryClient'
import { EMPTY_LIST } from '@/utils/emptyList'
import type { ScoreAggregate, ScoreProgress } from '@/types'

/** Historical data calls are immutable; only the newest call's rows move. */
const HISTORY_STALE_MS = 5 * 60_000
const HISTORY_GC_MS = 10 * 60_000

/**
 * Fetches score aggregates. Omitting `datacallId` returns the full per-cycle
 * series - see `apiPaths.scores.history`.
 *
 * Always resolves to an array: the backend serializes an empty result as JSON
 * null on some endpoints (ztmf#346).
 * @param {object} params - datacallId / systemId / includePillars.
 * @param {AbortSignal} [signal] - Abort signal from the query.
 * @returns {Promise<ScoreAggregate[]>} The aggregate rows.
 */
export async function fetchScoreAggregates(
  params: {
    datacallId?: number
    systemId?: number
    includePillars?: boolean
  } = {},
  signal?: AbortSignal
): Promise<ScoreAggregate[]> {
  const response = await axiosInstance.get<{ data: ScoreAggregate[] | null }>(
    apiPaths.scores.aggregate(params),
    { signal }
  )
  return response.data.data ?? []
}

/**
 * Fetches per-system questionnaire progress for one data call.
 * @param {number} datacallId - The data call.
 * @param {AbortSignal} [signal] - Abort signal from the query.
 * @returns {Promise<ScoreProgress[]>} The progress rows.
 */
export async function fetchScoreProgress(
  datacallId: number,
  signal?: AbortSignal
): Promise<ScoreProgress[]> {
  const response = await axiosInstance.get<{ data: ScoreProgress[] | null }>(
    apiPaths.scores.progress(datacallId),
    { signal }
  )
  return response.data.data ?? []
}

/**
 * Per-datacall aggregates for a set of calls, as an array aligned to
 * `datacallIds` by index - the shape `buildDashboardMaps` consumes.
 *
 * A failed or still-pending call yields EMPTY_LIST rather than collapsing the
 * array, preserving both the index alignment and the "one call's failure does
 * not sink the batch" behavior the dashboard relies on.
 * @param {number[]} datacallIds - Active call ids, newest first.
 * @param {QueryHookOptions} [options] - Standard enabled flag.
 * @returns {{scoresPerCall: ScoreAggregate[][], isPending: boolean, isError: boolean}} Aligned rows and load state.
 */
export function useDatacallAggregates(
  datacallIds: number[],
  options: QueryHookOptions = {}
): {
  scoresPerCall: ScoreAggregate[][]
  isPending: boolean
  isError: boolean
} {
  return useQueries({
    queries: datacallIds.map((id) => ({
      queryKey: queryKeys.scores.aggregate({ datacallId: id }),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchScoreAggregates({ datacallId: id }, signal),
      enabled: options.enabled !== false,
    })),
    // `combine` is structurally memoized by the library, so the returned
    // arrays keep a stable identity between renders and a consumer can use
    // them as memo dependencies without re-running on every paint.
    combine: (results) => ({
      scoresPerCall: results.map((r) => r.data ?? (EMPTY_LIST as never[])),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
    }),
  })
}

/**
 * Per-datacall progress rows, aligned to `datacallIds` by index.
 * @param {number[]} datacallIds - Active call ids, newest first.
 * @param {QueryHookOptions} [options] - Standard enabled flag.
 * @returns {{progressPerCall: ScoreProgress[][], isPending: boolean, isError: boolean}} Aligned rows and load state.
 */
export function useDatacallProgress(
  datacallIds: number[],
  options: QueryHookOptions = {}
): {
  progressPerCall: ScoreProgress[][]
  isPending: boolean
  isError: boolean
} {
  return useQueries({
    queries: datacallIds.map((id) => ({
      queryKey: queryKeys.scores.progress(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchScoreProgress(id, signal),
      enabled: options.enabled !== false,
    })),
    combine: (results) => ({
      progressPerCall: results.map((r) => r.data ?? (EMPTY_LIST as never[])),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
    }),
  })
}

/**
 * Pillar-level detail for ONE data call.
 *
 * Deliberately a single call rather than the whole active set: pillars
 * multiply the row count by roughly the pillar count, and one anchor call is
 * enough to chart a pillar profile.
 * @param {number} [datacallId] - The anchor call; disabled when undefined.
 * @param {QueryHookOptions} [options] - Standard enabled flag.
 * @returns {UseQueryResult<ScoreAggregate[]>} The query result.
 */
export function usePillarAggregates(
  datacallId: number | undefined,
  options: QueryHookOptions = {}
): UseQueryResult<ScoreAggregate[]> {
  return useQuery({
    queryKey: queryKeys.scores.aggregate({
      datacallId,
      includePillars: true,
    }),
    queryFn: ({ signal }) =>
      fetchScoreAggregates(
        { datacallId: datacallId as number, includePillars: true },
        signal
      ),
    enabled: datacallId !== undefined && options.enabled !== false,
  })
}

/**
 * The full per-cycle series across every data call, for trend charts.
 *
 * Expensive server-side - it spans every scored (system, call) pair - so it
 * never requests pillars and is cached longer than the per-call queries.
 * @param {QueryHookOptions} [options] - Standard enabled flag.
 * @returns {UseQueryResult<ScoreAggregate[]>} The query result.
 */
export function useScoreHistory(
  options: QueryHookOptions = {}
): UseQueryResult<ScoreAggregate[]> {
  return useQuery({
    queryKey: queryKeys.scores.history(),
    queryFn: ({ signal }) => fetchScoreAggregates({}, signal),
    enabled: options.enabled !== false,
    staleTime: HISTORY_STALE_MS,
    gcTime: HISTORY_GC_MS,
  })
}
