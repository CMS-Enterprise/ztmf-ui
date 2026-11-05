import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QueryHookOptions } from '@/queryClient'
import { EMPTY_LIST } from '@/utils/emptyList'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import type { datacall, QuestionnaireVersion } from '@/types'

/** Fetches every questionnaire version, newest first. */
export async function fetchQuestionnaireVersions(
  signal?: AbortSignal
): Promise<QuestionnaireVersion[]> {
  const response = await axiosInstance.get<{ data: QuestionnaireVersion[] }>(
    apiPaths.questionnaireVersions,
    { signal }
  )
  return response.data.data
}

/**
 * Reads the questionnaire versions: empty until the fetch resolves, and empty
 * on failure, which callers treat as "nothing to show".
 *
 * @param options - See QueryHookOptions.
 * @returns The versions, newest first.
 */
export function useQuestionnaireVersions(
  options: QueryHookOptions = {}
): QuestionnaireVersion[] {
  const { data } = useQuery({
    queryKey: queryKeys.questionnaireVersions.list(),
    queryFn: ({ signal }) => fetchQuestionnaireVersions(signal),
    enabled: options.enabled,
    // Refetched on every open, since a version can be published meanwhile.
    staleTime: 0,
    meta: { suppressErrorNotification: true },
  })
  return data ?? EMPTY_LIST
}

/**
 * The version a new data call pins when it names none: the newest published,
 * matching the API's MAX(versionid) default (ztmf-misc#397).
 */
export function newestPublishedVersion(
  versions: readonly QuestionnaireVersion[]
): QuestionnaireVersion | null {
  return versions.reduce<QuestionnaireVersion | null>(
    (best, v) =>
      v.state === 'published' && (!best || v.versionid > best.versionid)
        ? v
        : best,
    null
  )
}

/**
 * The call a new one rolls answers forward from: the latest whose deadline is
 * strictly before the new deadline, as the API resolves it. Without a deadline
 * yet, the latest call, which is what a normal new cycle gets.
 *
 * @param datacalls - Existing calls, in any order.
 * @param deadline - The new call's deadline as YYYY-MM-DD, or empty.
 */
export function previousDatacall(
  datacalls: datacall[],
  deadline: string
): datacall | null {
  const sorted = sortDatacallsByDeadline(datacalls)
  if (!deadline) return sorted[0] ?? null
  const cutoff = new Date(deadline).getTime()
  return sorted.find((d) => new Date(d.deadline).getTime() < cutoff) ?? null
}
