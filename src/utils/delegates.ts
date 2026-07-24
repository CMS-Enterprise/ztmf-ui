import axiosInstance from '@/axiosConfig'
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
    `/fismasystems/${systemId}/delegates`,
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
    `/fismasystems/${systemId}/delegate-candidates`,
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
  await axiosInstance.post(`/fismasystems/${systemId}/delegates`, body, {
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
    `/fismasystems/${systemId}/delegates/${userid}`,
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
  await axiosInstance.delete(`/fismasystems/${systemId}/delegates/${userid}`)
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
    `/opdivs/${opdivId}/system-delegate-enabled`,
    { enabled }
  )
  return res.data.data
}
