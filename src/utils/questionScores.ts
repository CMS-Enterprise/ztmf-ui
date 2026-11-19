import { queryOptions, useQuery } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QuestionScores } from '@/types'

/** A system's saved answers for one data call, keyed by functionoptionid. */
export type QuestionScoreMap = Record<number, QuestionScores>

/**
 * Reads a system's saved answers for one data call, each with its function
 * option so a row maps back to its question.
 *
 * @param datacallId - The data call the answers belong to.
 * @param systemId - The fismasystemid.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The rows (empty when the system has no answers yet).
 */
export async function fetchQuestionScores(
  datacallId: number,
  systemId: number,
  signal?: AbortSignal
): Promise<QuestionScores[]> {
  const res = await axiosInstance.get<{ data: QuestionScores[] | null }>(
    apiPaths.scores.list(datacallId, systemId, true),
    { signal }
  )
  return res.data.data ?? []
}

/**
 * Query options for the questionnaire's saved answers.
 *
 * Zero stale time: these are answers other people edit while the page is
 * open, and the questionnaire reads them again after every save, confirm and
 * undo, including an undo conflict that invalidates nothing first. Under the
 * default stale window those reads would return the rows from before the
 * write. The key sits under `scores`, so every score write already
 * invalidates it.
 *
 * A failure is not toasted from the cache. The questionnaire decides per read
 * whether one is worth telling the user about.
 */
export const questionScoresQuery = (datacallId: number, systemId: number) =>
  queryOptions({
    queryKey: queryKeys.scores.list(datacallId, systemId, true),
    queryFn: ({ signal }) => fetchQuestionScores(datacallId, systemId, signal),
    staleTime: 0,
    meta: { suppressErrorNotification: true },
  })

/** Which system's answers, for which data call. */
export type QuestionScoresKey = { systemId: number; datacallId: number }

/**
 * Renders a system's saved answers for one data call, or nothing while `key`
 * is null.
 *
 * The page decides when to read the server: it awaits `fetchQuery` before it
 * moves the key, and rereads explicitly after a save, confirm or undo. So
 * this observer never refetches on its own account (infinite stale time).
 * It still refetches when a score write invalidates the key, which is the
 * only way the server's answers change under it.
 *
 * @param key - The system and data call, or null for none.
 * @returns The rows, or undefined until a key is set and its data arrives.
 */
export function useQuestionScores(
  key: QuestionScoresKey | null
): QuestionScores[] | undefined {
  const { data } = useQuery({
    ...questionScoresQuery(key?.datacallId ?? 0, key?.systemId ?? 0),
    enabled: key !== null,
    staleTime: Infinity,
  })
  return data
}

/** Index rows by functionoptionid, the key the questionnaire looks them up by. */
export function indexScoresByOption(rows: QuestionScores[]): QuestionScoreMap {
  return Object.fromEntries(rows.map((row) => [row.functionoptionid, row]))
}

/**
 * The most recent last_edited_at across the rows, or null when none has one.
 * Seeds the "last saved" indicator on first paint.
 */
export function latestEditedAt(rows: QuestionScores[]): Date | null {
  let maxAt = 0
  for (const r of rows) {
    if (!r.last_edited_at) continue
    const t = new Date(r.last_edited_at).getTime()
    if (Number.isFinite(t) && t > maxAt) maxAt = t
  }
  return maxAt > 0 ? new Date(maxAt) : null
}
