import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QueryHookOptions } from '@/queryClient'

/**
 * OpDiv grant management for a single user (users_opdivs membership).
 *
 * fetchUserOpDivs reads the current grant set for a user. The users list
 * carries the same set inline on each row, so a direct read is only needed by
 * the grant modal, which must see the current set on open.
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
 * Reads a user's OpDiv grants for the grant modal.
 *
 * Grants decide what an admin may grant, so a read is only trustworthy when it
 * is current: the stale time is zero, which makes every enable a fresh
 * request rather than a cache hit. The users table does not read this key; it
 * renders the grants the list returns inline on each row.
 *
 * A reconnect does not refetch. The modal treats any in-flight read as its
 * initial load, blanking and disabling the picker, so a background refetch
 * mid-edit would lock the user out of their own changes, and one that failed
 * would leave Save disabled with the edits intact. Open and a change of user
 * are the only fetch triggers.
 *
 * The caller owns the error surface. The modal shows one toast for its two
 * reads, so the cache boundary stays silent for this key.
 *
 * @param userid - The user to read grants for.
 * @param options - `enabled`, per QueryHookOptions.
 * @returns The query result; `data` is the granted opdiv ids.
 */
export function useUserOpDivs(userid: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.users.assignedOpdivs(userid),
    queryFn: ({ signal }) => fetchUserOpDivs(userid, signal),
    staleTime: 0,
    refetchOnReconnect: false,
    ...options,
    meta: { suppressErrorNotification: true },
  })
}

/**
 * Mutation that replaces a user's grant set.
 *
 * On success the user's cache entry is invalidated rather than seeded from the
 * request. The body is not the stored set for every caller: a scoped admin
 * sends only the OpDivs they hold, and the backend preserves the target's
 * other grants, so writing the body into the cache would drop chips the user
 * still has. The modal refetches on its next open. Error handling stays with
 * the caller.
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
    onSuccess: (_data, { userid }) => {
      // refetchType none: the modal is still mounted when this runs and closes
      // immediately after, so an active refetch here is a read nobody reads.
      // Marking the entry stale is enough, since the next open refetches.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.assignedOpdivs(userid),
        refetchType: 'none',
      })
    },
  })
}
