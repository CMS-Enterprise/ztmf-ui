import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QueryHookOptions } from '@/queryClient'
import { EMPTY_LIST } from '@/utils/emptyList'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import type { datacall } from '@/types'

/**
 * Reads every data call, newest deadline first.
 *
 * "Latest" means the furthest-out deadline rather than the highest id, because
 * a historical load can carry a higher id than the real current call. The sort
 * lives in `select` so every consumer sees the same order without repeating it,
 * and so a refetch cannot briefly hand back an unsorted list.
 *
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The data calls as served.
 */
export async function fetchDatacalls(
  signal?: AbortSignal
): Promise<datacall[]> {
  const res = await axiosInstance.get<{ data: datacall[] | null }>(
    apiPaths.datacalls.root,
    { signal }
  )
  return res.data.data ?? []
}

/**
 * Reads the deadline-sorted data calls for a component.
 *
 * @param options - `enabled`, for a layout that must not fetch before the
 *   session loader has authenticated.
 * @returns The sorted rows and whether the first load has settled.
 */
export function useDatacalls(options: QueryHookOptions = {}): {
  datacalls: datacall[]
  datacallsLoaded: boolean
} {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.datacalls.list(),
    queryFn: ({ signal }) => fetchDatacalls(signal),
    select: sortDatacallsByDeadline,
    enabled: options.enabled,
  })
  return { datacalls: data ?? EMPTY_LIST, datacallsLoaded: !isPending }
}

/** Request body for POST /datacalls. */
export type DatacallInput = {
  /** Display name, upper-cased by the caller before it is sent. */
  datacall: string
  /** Deadline as an ISO 8601 timestamp. */
  deadline: string
}

/**
 * Creates a data call.
 *
 * @param input - The name and deadline for the new call.
 */
export async function createDatacall(input: DatacallInput): Promise<void> {
  await axiosInstance.post(apiPaths.datacalls.root, input)
}

/**
 * Mutation that creates a data call.
 *
 * On success every cached data-call list is invalidated. Nothing reads that
 * key yet: the layout still holds the list in component state and refreshes
 * it through a callback the modal fires. The invalidation is here so the
 * refresh works on its own once that read becomes a query, and the callback
 * goes away at the same time.
 *
 * Not awaited, so the dialog closes on the write rather than waiting for a
 * list that nothing is rendering from yet. Error handling stays with the
 * caller, which routes a 400's field map to the matching inputs.
 *
 * @returns The mutation, taking a DatacallInput.
 */
export function useCreateDatacall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDatacall,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.datacalls.all })
    },
  })
}
