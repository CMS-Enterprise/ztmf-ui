import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QueryHookOptions } from '@/queryClient'

/**
 * OpDiv grant management for a single user (users_opdivs membership).
 *
 * fetchUserOpDivs reads the current grant set for a user. The users list
 * carries the same set inline on each row, so a direct read is only needed by
 * the grant modal, which must see the current set on open, and by a table row
 * from an older backend that omitted the inline field.
 *
 * setUserOpDivs replaces the full grant set in one batch request. The backend
 * reconciles the desired set against current grants (adds missing, removes
 * extra) in one transaction and re-derives identity_provider once.
 */

/**
 * Reads a user's current OpDiv grant ids.
 *
 * @param userid - The user to read grants for.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The granted opdiv ids (empty array when none).
 */
export async function fetchUserOpDivs(
  userid: string,
  signal?: AbortSignal
): Promise<number[]> {
  const response = await axiosInstance.get<{ data: number[] | null }>(
    apiPaths.users.assignedOpdivs(userid),
    { signal }
  )
  return response.data.data ?? []
}

/**
 * Replaces a user's full OpDiv grant set.
 *
 * @param userid - The user whose grants are being set.
 * @param opdivIds - The complete desired set of opdiv ids.
 */
export async function setUserOpDivs(
  userid: string,
  opdivIds: number[]
): Promise<void> {
  await axiosInstance.put(apiPaths.users.opdivs(userid), {
    opdiv_ids: opdivIds,
  })
}

/**
 * Reads a user's OpDiv grants for a component.
 *
 * Grants decide what an admin may grant, so a read is only trustworthy when it
 * is current: the default stale time is zero, which makes every enable a fresh
 * request rather than a cache hit. A caller that wants one read for the life
 * of a mount, such as a table cell, passes `staleTime: Infinity`.
 *
 * Callers own the error surface. The grant modal shows one toast for its two
 * reads, and the table cell renders as empty, so the cache boundary stays
 * silent for this key.
 *
 * @param userid - The user to read grants for.
 * @param options - `enabled` and `staleTime`, per QueryHookOptions.
 * @returns The query result; `data` is the granted opdiv ids.
 */
export function useUserOpDivs(userid: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.users.assignedOpdivs(userid),
    queryFn: ({ signal }) => fetchUserOpDivs(userid, signal),
    staleTime: 0,
    ...options,
    meta: { suppressErrorNotification: true },
  })
}

/**
 * Mutation that replaces a user's grant set.
 *
 * On success the user's cache entry is seeded from the request rather than
 * refetched. The PUT replaces the full set and the backend rejects a set it
 * will not honor outright, so on a 2xx the stored set is exactly what was
 * sent. Any reader of that key repaints without a second request, including
 * one that is not enabled. Error handling stays with the caller.
 *
 * @returns The mutation, taking the user id and the complete desired set.
 */
export function useSetUserOpDivs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      userid,
      opdivIds,
    }: {
      userid: string
      opdivIds: number[]
    }) => setUserOpDivs(userid, opdivIds),
    onSuccess: (_data, { userid, opdivIds }) => {
      queryClient.setQueryData(queryKeys.users.assignedOpdivs(userid), opdivIds)
    },
  })
}
