import { useCallback, useMemo } from 'react'
import {
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { EMPTY_LIST } from '@/utils/emptyList'
import type { ScoreAggregate, ScoreProgress } from '@/types'

/**
 * Reads the score aggregate for one data call.
 *
 * @param datacallId - The data call to aggregate.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns One row per system in the call (empty array when none).
 */
export async function fetchScoreAggregate(
  datacallId: number,
  signal?: AbortSignal
): Promise<ScoreAggregate[]> {
  const res = await axiosInstance.get<{ data: ScoreAggregate[] | null }>(
    apiPaths.scores.aggregateByDatacall(datacallId),
    { signal }
  )
  return res.data.data ?? []
}

/**
 * Reads questionnaire progress for one data call.
 *
 * @param datacallId - The data call to report on.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns One row per system in the call (empty array when none).
 */
export async function fetchScoreProgress(
  datacallId: number,
  signal?: AbortSignal
): Promise<ScoreProgress[]> {
  const res = await axiosInstance.get<{ data: ScoreProgress[] | null }>(
    apiPaths.scores.progress(datacallId),
    { signal }
  )
  return res.data.data ?? []
}

/**
 * Query options for one data call's aggregate.
 *
 * Exported as options rather than a hook so the dashboard's fan-out and its
 * single prior-call read can share them. Sharing the key is the point: when
 * the prior call is also switched on, the two collapse into one request
 * instead of asking for the same aggregate twice.
 *
 * A failed read stays silent. The dashboard renders a system with no scores
 * the same way whether the read failed or the system is genuinely unscored,
 * and the fan-out means one bad call would otherwise toast on every visit.
 *
 * @param datacallId - The data call to aggregate.
 * @returns Options to pass to useQuery or useQueries.
 */
export function scoreAggregateQuery(datacallId: number) {
  return {
    queryKey: queryKeys.scores.aggregateByDatacall(datacallId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchScoreAggregate(datacallId, signal),
    meta: { suppressErrorNotification: true },
  }
}

/**
 * Query options for one data call's progress. Silent on failure for the same
 * reason as the aggregate above.
 *
 * @param datacallId - The data call to report on.
 * @returns Options to pass to useQuery or useQueries.
 */
export function scoreProgressQuery(datacallId: number) {
  return {
    queryKey: queryKeys.scores.progress(datacallId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchScoreProgress(datacallId, signal),
    meta: { suppressErrorNotification: true },
  }
}

/**
 * Reads the aggregate and progress for several data calls at once.
 *
 * One failed call does not sink the batch: a rejected query resolves to an
 * empty list here, matching the per-request catch this replaces, so the
 * dashboard still renders every call that did answer.
 *
 * The returned object is referentially stable while the underlying results
 * are, so a caller can use it as a memo dependency.
 *
 * @param datacallIds - The calls to read, in the order the caller merges them.
 * @returns The per-call rows in that same order, and whether every read is
 *   still on its first load.
 */
/**
 * Folds one set of per-call results into the rows and the first-load flag.
 *
 * Declared at module scope so its identity is stable: `combine` runs on every
 * render when the function itself changes, and its memoized result is what
 * keeps the caller's derived maps from being rebuilt on every keystroke and
 * every row checkbox.
 *
 * `pending` is every read still on its first load, not any read in flight.
 * Switching another data call on adds pending queries beside ones that
 * already answered, and treating that as loading would swap the dashboard
 * for a spinner and take the user's filters and sort with it.
 *
 * @param results - One result per data call, in the order asked for.
 * @returns The rows per call, and whether nothing has arrived yet.
 */
function combineRows<T>(results: Array<UseQueryResult<T[]>>): {
  rows: T[][]
  pending: boolean
} {
  return {
    rows: results.map((q) => q.data ?? (EMPTY_LIST as T[])),
    pending: results.length > 0 && results.every((q) => q.isPending),
  }
}

const combineAggregates = (results: Array<UseQueryResult<ScoreAggregate[]>>) =>
  combineRows(results)
const combineProgress = (results: Array<UseQueryResult<ScoreProgress[]>>) =>
  combineRows(results)

export function useDashboardScores(datacallIds: number[]): {
  scoresPerCall: ScoreAggregate[][]
  progressPerCall: ScoreProgress[][]
  loading: boolean
} {
  const aggregates = useQueries({
    queries: datacallIds.map(scoreAggregateQuery),
    combine: combineAggregates,
  })
  const progress = useQueries({
    queries: datacallIds.map(scoreProgressQuery),
    combine: combineProgress,
  })
  return useMemo(
    () => ({
      scoresPerCall: aggregates.rows,
      progressPerCall: progress.rows,
      loading: aggregates.pending || progress.pending,
    }),
    [aggregates, progress]
  )
}

/**
 * Marks every cached score read stale after a write to an answer.
 *
 * The dashboard's aggregates and its progress counts are both derived from
 * answers, and they sit under the default stale time, so without this a user
 * who saves and returns within the minute reads their old score out of cache.
 * The questionnaire's own score list is derived from the same write.
 *
 * The whole `scores` prefix goes rather than the keys for one data call: a
 * write carries the system and call it touched, but `diff` and the
 * per-system aggregate are keyed on neither, and a stale row in any of them
 * is the bug this exists to prevent. These lists are small and the refetch
 * only happens for the ones on screen.
 *
 * @returns A callback to run after a score write succeeds.
 */
export function useInvalidateScores(): () => void {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.scores.all })
  }, [queryClient])
}
