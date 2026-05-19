import axiosInstance from '@/axiosConfig'
import type { OpDiv } from '@/types'

/**
 * Fetches the OpDiv reference list from GET /api/v1/opdivs.
 *
 * The endpoint is open to any authenticated user. By default the
 * backend filters to active rows only; pass includeInactive to retrieve
 * deactivated rows as well (used by audit and historical-reference UI).
 *
 * Stage 1 publishes this helper so Stage 2+ work (OpDiv badges,
 * selectors, admin grant management) can consume it without each
 * caller hand-rolling the request. There is no production caller yet.
 */
export async function fetchOpDivs(includeInactive = false): Promise<OpDiv[]> {
  const response = await axiosInstance.get<{ data: OpDiv[] }>('/opdivs', {
    params: includeInactive ? { active_only: false } : undefined,
  })
  return response.data.data
}
