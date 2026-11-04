import { useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { DatacallCadence } from '@/types'

/** Request body for POST /datacalls. */
export type DatacallInput = {
  /** Free-text title. */
  datacall: string
  /** Four-digit fiscal year, e.g. 2027. Required by the backend. */
  fiscal_year: number
  /** Optional; the backend defaults to annual. */
  cadence?: DatacallCadence
  /** Deadline as an ISO 8601 timestamp. */
  deadline: string
}

/**
 * Creates a data call.
 *
 * @param input - The title, fiscal year, cadence and deadline for the new call.
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
