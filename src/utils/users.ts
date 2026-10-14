/**
 * Shared query hook for the user list.
 *
 * Not cached as vocabulary: grants and roles are edited on the Users page, and
 * a stale roster would misreport who covers an OpDiv.
 *
 * @module utils/users
 */
import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { type QueryHookOptions } from '@/queryClient'
import type { users } from '@/types'

/**
 * Fetches the user list, server-narrowed to the caller's OpDiv scope.
 * @param {AbortSignal} [signal] - Abort signal from the query.
 * @returns {Promise<users[]>} The rows.
 */
export async function fetchUsers(signal?: AbortSignal): Promise<users[]> {
  const response = await axiosInstance.get<{ data: users[] | null }>(
    apiPaths.users.root,
    { signal }
  )
  return response.data.data ?? []
}

/**
 * Reads the user list for a component.
 * @param {QueryHookOptions} [options] - Standard enabled flag.
 * @returns {UseQueryResult<users[]>} The query result.
 */
export function useUsers(
  options: QueryHookOptions = {}
): UseQueryResult<users[]> {
  return useQuery({
    queryKey: queryKeys.users.list(false),
    queryFn: ({ signal }) => fetchUsers(signal),
    enabled: options.enabled !== false,
  })
}

/**
 * Marks the cached user list stale after a user, grant or delegate write.
 * @param {QueryClient} queryClient - The app's query client.
 * @returns {void}
 */
export function invalidateUserList(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() })
}

/**
 * {@link invalidateUserList} bound to the current query client.
 * @returns {() => void} Call after a successful write.
 */
export function useInvalidateUserList(): () => void {
  const queryClient = useQueryClient()
  return () => invalidateUserList(queryClient)
}
