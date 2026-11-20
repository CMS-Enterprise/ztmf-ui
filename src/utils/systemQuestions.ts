import { queryOptions, useQuery } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { FismaQuestion } from '@/types'

/**
 * Reads the questionnaire a system answers for one data call, pinned to that
 * call's questionnaire version (ztmf-misc#395). The API applies the
 * reduced-pillar rule for the call (ztmf#545) and returns the rows in display
 * order (ztmf-misc#393).
 *
 * Decommissioned systems join to zero functions, so the endpoint returns no
 * rows. The backend serializes a nil slice as JSON null, so both
 * `{ data: null }` and `{ data: [] }` read as an empty list.
 *
 * @param systemId - The fismasystemid.
 * @param datacallId - The data call whose questionnaire version to read.
 * @param signal - Optional AbortSignal to cancel the request.
 */
export async function fetchSystemQuestions(
  systemId: number,
  datacallId: number,
  signal?: AbortSignal
): Promise<FismaQuestion[]> {
  const res = await axiosInstance.get<{ data: FismaQuestion[] | null }>(
    apiPaths.fismaSystems.questions(systemId, datacallId),
    { signal }
  )
  return res.data?.data ?? []
}

/**
 * Query options for a system's questionnaire in one data call.
 *
 * A failure is not toasted from the cache: the questionnaire reports it where
 * it loads the page.
 */
export const systemQuestionsQuery = (systemId: number, datacallId: number) =>
  queryOptions({
    queryKey: queryKeys.fismaSystems.questions(systemId, datacallId),
    queryFn: ({ signal }) => fetchSystemQuestions(systemId, datacallId, signal),
    meta: { suppressErrorNotification: true },
  })

/** Which system's questionnaire, for which data call. */
export type SystemQuestionsKey = { systemId: number; datacallId: number }

/**
 * Reads a system's questionnaire for one data call, or nothing while `key`
 * is null.
 *
 * The key is the caller's to move. The questionnaire moves it only after it
 * has awaited the same query through `fetchQuery`, so the read here is served
 * from the cache on the render the key changes, and what it renders switches
 * at the moment the page chooses rather than whenever the response lands.
 * Infinite stale time for the same reason: a background refetch (on
 * reconnect, say) that brought back changed rows would hand the page new
 * questions mid-edit and re-seed the answer over the user's changes.
 *
 * @param key - The system and data call, or null for none.
 * @returns The rows, or undefined until a key is set and its data arrives.
 */
export function useSystemQuestions(
  key: SystemQuestionsKey | null
): FismaQuestion[] | undefined {
  const { data } = useQuery({
    ...systemQuestionsQuery(key?.systemId ?? 0, key?.datacallId ?? 0),
    enabled: key !== null,
    staleTime: Infinity,
  })
  return data
}
