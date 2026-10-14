import { useCallback } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
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
 * @param datacallIds - The calls to read, in the order the caller merges them.
 * @returns The per-call rows in that same order, and whether any read is still
 *   on its first load.
 */
export function useDashboardScores(datacallIds: number[]): {
  scoresPerCall: ScoreAggregate[][]
  progressPerCall: ScoreProgress[][]
  loading: boolean
} {
  const aggregates = useQueries({
    queries: datacallIds.map(scoreAggregateQuery),
  })
  const progress = useQueries({
    queries: datacallIds.map(scoreProgressQuery),
  })
  return {
    scoresPerCall: aggregates.map((q) => q.data ?? []),
    progressPerCall: progress.map((q) => q.data ?? []),
    loading: [...aggregates, ...progress].some((q) => q.isPending),
  }
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
