import axiosInstance from '@/axiosConfig'

/**
 * OpDiv grant management for a single user (users_opdivs membership).
 *
 * fetchUserOpDivs reads the current grant set for a user (used for post-save
 * refresh and as a fallback for older backends that omit assignedopdivids inline
 * on the list response).
 *
 * setUserOpDivs replaces the full grant set in one batch request. The backend
 * reconciles the desired set against current grants (adds missing, removes extra)
 * in one transaction and re-derives identity_provider once.
 */

export async function fetchUserOpDivs(userid: string): Promise<number[]> {
  const response = await axiosInstance.get<{ data: number[] }>(
    `/users/${userid}/assignedopdivs`
  )
  return response.data.data ?? []
}

export async function setUserOpDivs(
  userid: string,
  opdivIds: number[]
): Promise<void> {
  await axiosInstance.put(`/users/${userid}/opdivs`, { opdiv_ids: opdivIds })
}
