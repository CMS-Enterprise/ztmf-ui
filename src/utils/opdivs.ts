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

/**
 * Request body for POST /opdivs and PUT /opdivs/{opdiv_id} (OpDivInput).
 * `active` is honored on update only - a new OpDiv is always created active.
 */
export type OpDivInput = {
  code: string
  name: string
  is_parent?: boolean
  active?: boolean
}

/**
 * Creates an OpDiv via POST /opdivs (OWNER only). Returns the created row.
 * A 400 carries a field-level message under data.code (e.g. a duplicate
 * active code) - callers should surface it inline via parseApiError.
 */
export async function createOpDiv(input: OpDivInput): Promise<OpDiv> {
  const response = await axiosInstance.post<{ data: OpDiv }>('/opdivs', input)
  return response.data.data
}

/**
 * Updates or deactivates an OpDiv via PUT /opdivs/{opdiv_id} (OWNER only).
 * Set active=false to soft-deactivate. The endpoint returns 204 (no body).
 */
export async function updateOpDiv(
  opdivId: number,
  input: OpDivInput
): Promise<void> {
  await axiosInstance.put(`/opdivs/${opdivId}`, input)
}
