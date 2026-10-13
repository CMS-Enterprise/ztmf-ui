import { useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import type { FismaSystemType } from '@/types'

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
 * On success that system's detail key is invalidated. Nothing reads it yet:
 * the detail page still resolves the system out of the shared list in Outlet
 * context and repaints from the record this mutation returns. The
 * invalidation is here so the repaint works on its own once the system
 * becomes a query, and the callback goes away at the same time.
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
    },
  })
}
