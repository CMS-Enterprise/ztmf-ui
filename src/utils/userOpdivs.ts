import axiosInstance from '@/axiosConfig'

/**
 * OpDiv grant management for a single user (users_opdivs membership).
 *
 * All three operations hit the dedicated /users/{userid}/assignedopdivs
 * endpoints, whose shape mirrors the existing assignedfismasystems endpoints
 * (GET returns { data: number[] }; POST body { opdiv_id }; DELETE by id).
 * Granting/revoking recomputes the user's derived identity_provider server-side.
 *
 * The list endpoint (GET /users) always returns assignedopdivids as null - the
 * join is skipped there - so callers must use fetchUserOpDivs per user rather
 * than reading a list row.
 *
 * NOTE: these endpoints are built on the backend RBAC branch
 * (feature/opdiv-rbac-enforcement) but are not yet in backend/openapi.yaml, so
 * this is built to the documented contract and may 404 until that branch ships.
 */

export async function fetchUserOpDivs(userid: string): Promise<number[]> {
  const response = await axiosInstance.get<{ data: number[] }>(
    `/users/${userid}/assignedopdivs`
  )
  return response.data.data ?? []
}

export async function grantOpDiv(
  userid: string,
  opdivId: number
): Promise<void> {
  await axiosInstance.post(`/users/${userid}/assignedopdivs`, {
    opdiv_id: opdivId,
  })
}

export async function revokeOpDiv(
  userid: string,
  opdivId: number
): Promise<void> {
  await axiosInstance.delete(`/users/${userid}/assignedopdivs/${opdivId}`)
}
