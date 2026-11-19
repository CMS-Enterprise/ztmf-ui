import { queryOptions, useQuery } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QuestionChoice, QuestionOption } from '@/types'

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

/**
 * Renders a function's answer options as radio choices, or nothing while
 * `functionId` is null.
 *
 * The questionnaire awaits the same query through `fetchQuery` before it
 * moves the id, so this is served from the cache on that render. Infinite
 * stale time: the page reads the server when a question loads, and moving
 * the id must not read it a second time.
 *
 * @param functionId - The functionid, or null for none.
 * @returns The choices in server order, or undefined until loaded.
 */
export function useFunctionOptions(
  functionId: number | null
): QuestionChoice[] | undefined {
  const { data } = useQuery({
    ...functionOptionsQuery(functionId ?? 0),
    enabled: functionId !== null,
    staleTime: Infinity,
    select: toQuestionChoices,
  })
  return data
}

/** Maps option rows to the radio group's choice shape. */
export function toQuestionChoices(rows: QuestionOption[]): QuestionChoice[] {
  return rows.map((row) => ({
    label: row.description,
    value: row.functionoptionid,
    score: row.score,
  }))
}
