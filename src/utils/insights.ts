import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { Insight, InsightPayload } from '@/types'

/**
 * Reads every ZTMF Insights row for one system, keyed by DB questionid.
 *
 * One call returns the rows for every question, so the questionnaire reads it
 * once per system rather than per question. Rows without a questionid or a
 * payload are dropped.
 *
 * @param systemId - The fismasystemid to read insights for.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The payloads by questionid (empty when the system has none).
 */
export async function fetchSystemInsights(
  systemId: number,
  signal?: AbortSignal
): Promise<Map<number, InsightPayload>> {
  const res = await axiosInstance.get<{ data: Insight[] | null }>(
    apiPaths.insights,
    { params: { fismasystemid: systemId }, signal }
  )
  const map = new Map<number, InsightPayload>()
  for (const row of res.data?.data ?? []) {
    if (row?.questionid != null && row.payload) {
      map.set(row.questionid, row.payload)
    }
  }
  return map
}

const EMPTY_INSIGHTS: ReadonlyMap<number, InsightPayload> = new Map()

/**
 * Reads a system's ZTMF Insights for the questionnaire.
 *
 * Insights are additive: every "off" case (OpDiv not enabled, not entitled,
 * not yet synced) answers an empty list, and a failure renders the page as it
 * is without them. So a failure is not toasted and not retried, and it reads
 * as an empty map. `settled` is false until the system's first answer or
 * failure, which the questionnaire uses to hold submission while a
 * carried-forward response's review UI is still unknown.
 *
 * Keyed per system, so switching systems never shows the previous system's
 * insights while the new ones load.
 *
 * @param systemId - The fismasystemid, or undefined while it resolves.
 */
export function useSystemInsights(systemId: number | undefined): {
  insightsByQuestion: ReadonlyMap<number, InsightPayload>
  settled: boolean
} {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.insights(systemId ?? 0),
    queryFn: ({ signal }) => fetchSystemInsights(systemId as number, signal),
    enabled: !!systemId,
    retry: false,
    meta: { suppressErrorNotification: true },
  })
  return {
    insightsByQuestion: data ?? EMPTY_INSIGHTS,
    settled: !!systemId && !isPending,
  }
}
