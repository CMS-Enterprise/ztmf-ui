/**
 * Shared query hook for the user list.
 *
 * Not cached as vocabulary: grants and roles are edited on the Users page, and
 * a stale roster would misreport who covers an OpDiv.
 *
 * @module utils/users
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
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
