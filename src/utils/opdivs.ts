import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { vocabularyQueryOptions, type QueryHookOptions } from '@/queryClient'
import { EMPTY_LIST } from '@/utils/emptyList'
import type { OpDiv } from '@/types'

/**
 * Fetches the OpDiv reference list from GET /api/v1/opdivs.
 *
 * The endpoint is open to any authenticated user. By default the
 * backend filters to active rows only; pass includeInactive to retrieve
 * deactivated rows as well (used by audit and historical-reference UI).
 *
 * Always resolves to an array: the backend serializes an empty result as JSON
 * null on some endpoints (ztmf#346), and this response feeds the shared Outlet
 * context, so a null would throw in every consumer at once.
 */
export async function fetchOpDivs(
  includeInactive = false,
  signal?: AbortSignal
): Promise<OpDiv[]> {
  const response = await axiosInstance.get<{ data: OpDiv[] | null }>(
    apiPaths.opdivs.root,
    {
      params: includeInactive ? { active_only: false } : undefined,
      signal,
    }
  )
  return response.data.data ?? []
}

/**
 * Reads the OpDiv reference list for a component. Cached for the session
 * under `vocabularyQueryOptions`; the write hooks below invalidate it, so a
 * change made in OpDiv admin reaches every consumer of the shared list.
 *
 * Unlike the other vocabulary hooks this returns the load state as well as
 * the rows. The questionnaire's insights gate needs to tell "not fetched yet"
 * from "fetched, and there are none", and the layout notifies on failure
 * because this is the only fetch site: an empty list would persist for the
 * session and leave the system form's Save stuck.
 *
 * Title reads the inactive-inclusive superset once and shares it through
 * Outlet context. Views should read the context rather than call this: a
 * second call with a different `includeInactive` is a second cache entry and
 * a second request for the same reference data.
 *
 * @param includeInactive - Pass true to include deactivated rows.
 * @param options - See QueryHookOptions.
 * @returns The rows, whether the load has settled (on failure too), and the
 *   error when it failed.
 */
export function useOpDivs(
  includeInactive = false,
  options: QueryHookOptions = {}
): { opdivs: OpDiv[]; opdivsLoaded: boolean; error: Error | null } {
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.opdivs.list(includeInactive),
    queryFn: ({ signal }) => fetchOpDivs(includeInactive, signal),
    enabled: options.enabled,
    ...vocabularyQueryOptions,
  })
  return { opdivs: data ?? EMPTY_LIST, opdivsLoaded: !isPending, error }
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
  const response = await axiosInstance.post<{ data: OpDiv }>(
    apiPaths.opdivs.root,
    input
  )
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
  await axiosInstance.put(apiPaths.opdivs.detail(opdivId), input)
}

/**
 * Mutation for creating an OpDiv. On success it invalidates every cached
 * OpDiv list so the shared copy refetches. Error handling stays with the
 * caller, which routes a 400's field-level message inline.
 *
 * @returns The mutation, taking an OpDivInput.
 */
export function useCreateOpDiv() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createOpDiv,
    // Not returned: awaiting the invalidation would hold the mutation
    // pending until the list refetches, keeping the dialog open. The write
    // is done; the list catches up behind it, as it did before.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.opdivs.all })
    },
  })
}

/**
 * Mutation for updating or deactivating an OpDiv. The endpoint returns no
 * body, so the cache cannot be seeded from the response and is invalidated
 * instead. Error handling stays with the caller.
 *
 * @returns The mutation, taking the target id and its OpDivInput.
 */
export function useUpdateOpDiv() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ opdivId, input }: { opdivId: number; input: OpDivInput }) =>
      updateOpDiv(opdivId, input),
    // Not returned: awaiting the invalidation would hold the mutation
    // pending until the list refetches, keeping the dialog open. The write
    // is done; the list catches up behind it, as it did before.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.opdivs.all })
    },
  })
}
