import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QueryHookOptions } from '@/queryClient'
import type { DelegateRow, DelegateCandidate, OpDiv } from '@/types'

/**
 * System-delegate self-service API (ztmf-ui#598, backend ztmf#462).
 *
 * Every delegate call the UI makes lives here, so moving from the mocked
 * contract to the real endpoints once the backend ships is a change to this
 * one file. All paths are system-anchored; the backend gates each on the
 * caller being assigned to the system (admins pass) and returns 404 for a
 * system the caller cannot manage.
 *
 * Payload the backend expects for the add call. Both flows are keyed by
 * email; the backend resolves it to a new-person invite or an attach of an
 * existing eligible delegate. userid / role / opdiv must never be sent -
 * unknown fields are rejected. access_expires_at is RFC3339; when omitted
 * the backend defaults it to three months out.
 */
export type AddDelegateBody = {
  email: string
  fullname?: string
  access_expires_at?: string
}

/**
 * Reads the current delegates assigned to a system (the roster).
 *
 * @param systemId - The fismasystemid to read delegates for.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The system's delegate rows (empty array when none).
 */
export async function fetchSystemDelegates(
  systemId: number,
  signal?: AbortSignal
): Promise<DelegateRow[]> {
  const res = await axiosInstance.get<{ data: DelegateRow[] | null }>(
    apiPaths.fismaSystems.delegates(systemId),
    { signal }
  )
  return res.data.data ?? []
}

/**
 * Searches users eligible to be attached to a system as a delegate. The
 * backend returns only attachable candidates (already a delegate, in the
 * system's OpDiv, not deleted, not already attached), so the caller can
 * trust the list without re-filtering.
 *
 * @param systemId - The fismasystemid to find candidates for.
 * @param q - Case-insensitive substring on name/email; empty returns all eligible.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The eligible candidate rows (empty array when none).
 */
export async function searchDelegateCandidates(
  systemId: number,
  q: string,
  signal?: AbortSignal
): Promise<DelegateCandidate[]> {
  const res = await axiosInstance.get<{ data: DelegateCandidate[] | null }>(
    apiPaths.fismaSystems.delegateCandidates(systemId),
    { params: q ? { q } : undefined, signal }
  )
  return res.data.data ?? []
}

/**
 * Adds a delegate to a system - either inviting a new person (email +
 * fullname) or attaching an existing eligible delegate (email only). On an
 * attach the backend ignores access_expires_at; renew changes it instead.
 * Resolves on 201; the caller refetches the roster to reflect the add.
 *
 * @param systemId - The fismasystemid to add the delegate to.
 * @param body - Email-keyed add payload (see AddDelegateBody).
 */
export async function addSystemDelegate(
  systemId: number,
  body: AddDelegateBody
): Promise<void> {
  // skipAuthHandling so the capability-off 403 reaches this caller instead of the
  // global interceptor swallowing it into a generic toast; the component keys on
  // the DELEGATE_NOT_ENABLED code to render an in-dialog guard.
  await axiosInstance.post(apiPaths.fismaSystems.delegates(systemId), body, {
    skipAuthHandling: true,
  })
}

/**
 * Renews or changes a delegate's expiration. Expiry is per-user, so this
 * affects the delegate on every system they are assigned to.
 *
 * @param systemId - The fismasystemid the delegate is assigned to.
 * @param userid - The delegate's user UUID.
 * @param accessExpiresAt - New expiration (RFC3339); omit to default +3mo.
 * @returns The updated delegate row.
 */
export async function renewSystemDelegate(
  systemId: number,
  userid: string,
  accessExpiresAt?: string
): Promise<DelegateRow> {
  const res = await axiosInstance.patch<{ data: DelegateRow }>(
    apiPaths.fismaSystems.delegate(systemId, userid),
    { access_expires_at: accessExpiresAt }
  )
  return res.data.data
}

/**
 * Removes a delegate from a system. The user row and their assignments to
 * other systems are retained.
 *
 * @param systemId - The fismasystemid to remove the delegate from.
 * @param userid - The delegate's user UUID.
 */
export async function removeSystemDelegate(
  systemId: number,
  userid: string
): Promise<void> {
  await axiosInstance.delete(apiPaths.fismaSystems.delegate(systemId, userid))
}

/**
 * Toggles the per-OpDiv System Delegate capability. Dedicated endpoint,
 * authorized for Owner / HHS admin only (distinct from the Owner-only OpDiv
 * create/update).
 *
 * @param opdivId - The opdiv_id to toggle.
 * @param enabled - Whether the capability should be on.
 * @returns The updated OpDiv row.
 */
export async function setOpDivDelegateEnabled(
  opdivId: number,
  enabled: boolean
): Promise<OpDiv> {
  const res = await axiosInstance.put<{ data: OpDiv }>(
    apiPaths.opdivs.systemDelegateEnabled(opdivId),
    { enabled }
  )
  return res.data.data
}

/**
 * Reads a system's delegate roster for a component. A failure surfaces
 * through the cache boundary's toast, which carries the same parsed message
 * the section used to raise itself.
 *
 * Read fresh on every mount. The roster is the shared user-to-system table
 * filtered to delegates, so pages this module does not own change it: a role
 * edit or a system assignment moves someone on or off it. Those writes still
 * go through raw requests and invalidate nothing, so a stale window would
 * show a delegate the server no longer has. The generic stale time is meant
 * for reference data, and this is operational data someone else edits.
 *
 * @param systemId - The fismasystemid whose roster to read.
 * @returns The query result; `data` is the delegate rows.
 */
export function useSystemDelegates(systemId: number) {
  return useQuery({
    queryKey: queryKeys.fismaSystems.delegates(systemId),
    queryFn: ({ signal }) => fetchSystemDelegates(systemId, signal),
    staleTime: 0,
  })
}

/**
 * Searches the candidates eligible to attach to a system. Keyed on the search
 * term, with the previous result held while a new term loads so the picker
 * does not blank between keystrokes; the caller still debounces its input. A
 * failure is non-fatal, since an empty option list just means nothing to
 * attach.
 *
 * Not forced fresh the way the roster is. Every term the user has not just
 * typed is a new key and so a new request, each delegate write here
 * invalidates the lot, and an entry that did go stale is self-correcting:
 * the backend rejects an attach for someone no longer eligible. Zeroing the
 * stale time would instead refetch on each return to a previous term,
 * including the cleared one after an attach.
 *
 * @param systemId - The fismasystemid to find candidates for.
 * @param search - Case-insensitive substring on name/email; empty for all.
 * @param options - `enabled`, for a caller that only shows the picker to
 *   managers.
 * @returns The query result; `data` is the candidate rows.
 */
export function useDelegateCandidates(
  systemId: number,
  search: string,
  options: QueryHookOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.fismaSystems.delegateCandidates(systemId, search),
    queryFn: ({ signal }) => searchDelegateCandidates(systemId, search, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled,
    meta: { suppressErrorNotification: true },
  })
}

/**
 * Builds a system-scoped delegate mutation. Every delegate write changes both
 * the roster and who is still eligible to attach, so both are invalidated.
 * The roster invalidation is returned so the mutation resolves only once the
 * list has refetched: the section closes its dialogs and toasts against the
 * refreshed roster, as it did when it awaited the reload itself. The candidate
 * lists are invalidated without waiting, since nothing acts on them at that
 * moment. Error handling stays with the caller.
 */
function useSystemDelegateMutation<TVariables>(
  systemId: number,
  mutationFn: (variables: TVariables) => Promise<unknown>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fismaSystems.delegateCandidateLists(systemId),
      })
      return queryClient.invalidateQueries({
        queryKey: queryKeys.fismaSystems.delegates(systemId),
      })
    },
  })
}

/**
 * Mutation that adds a delegate to a system. The caller keys on the response
 * code to place a guard inline.
 *
 * @param systemId - The fismasystemid to add to.
 * @returns The mutation, taking an AddDelegateBody.
 */
export function useAddSystemDelegate(systemId: number) {
  return useSystemDelegateMutation(systemId, (body: AddDelegateBody) =>
    addSystemDelegate(systemId, body)
  )
}

/**
 * Mutation that renews or changes a delegate's expiration.
 *
 * @param systemId - The fismasystemid the delegate is assigned to.
 * @returns The mutation, taking the delegate's user id and the new expiry.
 */
export function useRenewSystemDelegate(systemId: number) {
  return useSystemDelegateMutation(
    systemId,
    ({
      userid,
      accessExpiresAt,
    }: {
      userid: string
      accessExpiresAt?: string
    }) => renewSystemDelegate(systemId, userid, accessExpiresAt)
  )
}

/**
 * Mutation that removes a delegate from a system.
 *
 * @param systemId - The fismasystemid to remove from.
 * @returns The mutation, taking the delegate's user id.
 */
export function useRemoveSystemDelegate(systemId: number) {
  return useSystemDelegateMutation(systemId, (userid: string) =>
    removeSystemDelegate(systemId, userid)
  )
}

/**
 * Mutation that toggles an OpDiv's System Delegate capability. The flag lives
 * on the OpDiv row every consumer reads from the shared list, so that list is
 * invalidated; not awaited, so the confirm dialog closes on the write.
 *
 * @returns The mutation, taking the opdiv id and the desired state.
 */
export function useSetOpDivDelegateEnabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ opdivId, enabled }: { opdivId: number; enabled: boolean }) =>
      setOpDivDelegateEnabled(opdivId, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.opdivs.all })
    },
  })
}
