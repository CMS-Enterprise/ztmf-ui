import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { QueryHookOptions } from '@/queryClient'
import { EMPTY_LIST } from '@/utils/emptyList'
import type { FismaSystemType } from '@/types'

/**
 * Reads the FISMA system list.
 *
 * @param decommissioned - Include decommissioned systems. Part of the cache
 *   key, so toggling swaps between two cached lists rather than refetching one.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The system rows (empty array when none).
 */
export async function fetchFismaSystems(
  decommissioned: boolean,
  signal?: AbortSignal
): Promise<FismaSystemType[]> {
  const res = await axiosInstance.get<{ data: FismaSystemType[] | null }>(
    apiPaths.fismaSystems.list(decommissioned),
    { signal }
  )
  return res.data.data ?? []
}

/**
 * Reads the shared FISMA system list for a component.
 *
 * The decommissioned flag is part of the key rather than a refetch trigger, so
 * flipping the dashboard toggle swaps to the other cached list and flipping
 * back is free.
 *
 * @param decommissioned - Pass true to include decommissioned systems.
 * @param options - `enabled`, for a layout that must not fetch before the
 *   session loader has authenticated.
 * @returns The rows and whether the first load has settled.
 */
export function useFismaSystems(
  decommissioned: boolean,
  options: QueryHookOptions = {}
): { fismaSystems: FismaSystemType[]; fismaSystemsLoaded: boolean } {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.fismaSystems.list(decommissioned),
    queryFn: ({ signal }) => fetchFismaSystems(decommissioned, signal),
    enabled: options.enabled,
  })
  return { fismaSystems: data ?? EMPTY_LIST, fismaSystemsLoaded: !isPending }
}

/**
 * Reads one FISMA system.
 *
 * Null, not undefined, when the server has none: a query whose function
 * resolves undefined is rejected by TanStack Query, which would turn a
 * served "no such system" into a failed query and a retry.
 *
 * @param systemId - The fismasystemid to read.
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns The system, or null when the server has none.
 */
export async function fetchFismaSystem(
  systemId: number,
  signal?: AbortSignal
): Promise<FismaSystemType | null> {
  const res = await axiosInstance.get<{ data: FismaSystemType | null }>(
    apiPaths.fismaSystems.detail(systemId),
    { signal }
  )
  return res.data?.data ?? null
}

/**
 * Reads one FISMA system for a component.
 *
 * The shared list is filtered, so a decommissioned system, or one created
 * since the list loaded, is missing from it. Pages that can be opened by id
 * read this as a fallback. A system that genuinely does not exist resolves to
 * null rather than erroring, because the caller renders a placeholder for
 * that case either way.
 *
 * Writes to this system invalidate the same key, so the detail repaints
 * without the caller pushing a replacement into shared state.
 *
 * @param systemId - The fismasystemid to read.
 * @param options - `enabled`, for a caller that only needs this when the
 *   shared list came up short.
 * @returns The query result; `data` is the system, or null when there is
 *   none and undefined until the read settles.
 */
export function useFismaSystem(
  systemId: number,
  options: QueryHookOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.fismaSystems.detail(systemId),
    queryFn: ({ signal }) => fetchFismaSystem(systemId, signal),
    enabled: options.enabled,
    meta: { suppressErrorNotification: true },
  })
}

/** Request body for PUT /fismasystems/{id}/target-maturity. */
export type TargetMaturityInput = {
  target_maturity_tier: string
  target_maturity_justification: string
}

/**
 * Sets a system's target maturity tier and the justification behind it.
 *
 * The endpoint contract is to echo the updated record. A 2xx without one is
 * returned as undefined rather than thrown: the caller renders that case with
 * its own message, and a thrown error would arrive at the caller's catch
 * indistinguishable from a network failure.
 *
 * @param systemId - The fismasystemid to update.
 * @param input - The tier and its justification.
 * @returns The updated system record, or undefined when the response carried
 *   none.
 */
export async function setTargetMaturity(
  systemId: number,
  input: TargetMaturityInput
): Promise<FismaSystemType | undefined> {
  const res = await axiosInstance.put<{ data: FismaSystemType | null }>(
    apiPaths.fismaSystems.targetMaturity(systemId),
    input
  )
  // Normalized to undefined so the declared return type covers both the
  // missing key and an explicit null in the envelope.
  return res.data?.data ?? undefined
}

/**
 * Mutation that sets a system's target maturity.
 *
 * On success both the system's detail key and the system lists are
 * invalidated. Both are needed: the detail page renders the system from the
 * shared list when it is there and from the per-system read when it is not,
 * so invalidating only one leaves the card showing the old tier on whichever
 * path it did not cover.
 *
 * Not awaited, so the card leaves edit mode on the write. Error handling
 * stays with the caller.
 *
 * @param systemId - The fismasystemid the card is editing.
 * @returns The mutation, taking a TargetMaturityInput and resolving to the
 *   updated system record, or undefined when the response carried none.
 */
export function useSetTargetMaturity(systemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TargetMaturityInput) =>
      setTargetMaturity(systemId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fismaSystems.detail(systemId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fismaSystems.lists(),
      })
    },
  })
}
