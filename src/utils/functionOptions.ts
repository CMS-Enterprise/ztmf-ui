import { queryOptions } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QuestionOption } from '@/types'

/**
 * Reads the answer options for one questionnaire function.
 *
 * @param functionId - The functionid the options belong to. The questionnaire
 *   calls this its questionId.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The options in server order (empty when there are none).
 */
export async function fetchFunctionOptions(
  functionId: number,
  signal?: AbortSignal
): Promise<QuestionOption[]> {
  const res = await axiosInstance.get<{ data: QuestionOption[] | null }>(
    apiPaths.functionOptions(functionId),
    { signal }
  )
  return res.data.data ?? []
}

/**
 * Query options for a function's answer options, shared by every reader so
 * they use one cache entry.
 *
 * A failure is not toasted from the cache: the questionnaire, the only reader,
 * handles it where it seeds the answer.
 */
export const functionOptionsQuery = (functionId: number) =>
  queryOptions({
    queryKey: queryKeys.functionOptions(functionId),
    queryFn: ({ signal }) => fetchFunctionOptions(functionId, signal),
    meta: { suppressErrorNotification: true },
  })
