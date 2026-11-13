import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/keys'
import { useContextProp } from '@/views/Title/Context'
import { useFismaSystem } from '@/utils/fismaSystems'
import { isAuthHandled } from '@/utils/notify'
import type { FismaSystemType } from '@/types'

/** Where a by-id system lookup stands. */
export type SystemResolution =
  | { status: 'resolving'; system: undefined }
  | { status: 'found'; system: FismaSystemType }
  | { status: 'not-found'; system: undefined }
  | { status: 'error'; system: undefined; retry: () => void }

/**
 * Resolves a system from its id for a page addressed by URL (System Detail,
 * Pillar Scores).
 *
 * The shared systems list is filtered, so a decommissioned system or a stale
 * deep link can be missing from it. When the id is not in the list, the
 * system is read by id through its own cache entry. The shared list is left
 * alone: it stays exactly what the server returned for the current view. The
 * wait is keyed on `fismaSystemsLoaded`, not on the list being non-empty: a
 * user with no accessible systems has an empty list forever, and still needs
 * to reach a not-found state instead of an endless spinner.
 *
 *   const resolution = useResolvedSystem(systemId)
 *   if (resolution.status === 'resolving') return <Spinner />
 *   if (resolution.status === 'not-found') return <NotFound />
 *   const { system } = resolution
 *
 * A system outside the caller's scope and one that does not exist both read
 * as not-found (see fetchFismaSystem). A lookup that fails for any other
 * reason (a 5xx, a network drop, a timeout) resolves to `error` with a
 * `retry`, not to not-found: the system may well exist and be the caller's,
 * so the page should not suggest otherwise. Once settled, not-found holds
 * when the list changes; a write to the system invalidates its by-id entry,
 * and that is what looks it up again.
 *
 * @param {number} systemId - The system id from the URL. A non-positive or
 *   non-numeric id resolves to not-found without a request.
 * @returns {SystemResolution} The lookup status and, once found, the system.
 */
export function useResolvedSystem(systemId: number): SystemResolution {
  const { fismaSystems, fismaSystemsLoaded } = useContextProp()
  const queryClient = useQueryClient()
  const listed = fismaSystems.find((s) => s.fismasystemid === systemId)
  const validId = Number.isInteger(systemId) && systemId > 0

  const detailQuery = useFismaSystem(systemId, {
    enabled: validId && fismaSystemsLoaded && listed === undefined,
  })

  // Seed the by-id entry from the list while the system is still in it. A
  // save can move the system out of the current view, and then the list comes
  // back without it and the by-id read starts from nothing, so the page would
  // blank until that read answers. With the seed the read has the last known
  // row to serve while it refreshes underneath.
  useEffect(() => {
    if (!listed) return
    queryClient.setQueryData(queryKeys.fismaSystems.detail(systemId), listed)
  }, [listed, systemId, queryClient])

  if (listed) return { status: 'found', system: listed }
  if (!validId) return { status: 'not-found', system: undefined }
  if (!fismaSystemsLoaded) return { status: 'resolving', system: undefined }
  // Checked before the error: a background refetch that fails keeps the
  // last good row, and the page should keep showing it.
  if (detailQuery.data) return { status: 'found', system: detailQuery.data }
  if (detailQuery.data === null) {
    return { status: 'not-found', system: undefined }
  }
  // A 401 is already navigating to sign-in, so the failure screen and its
  // Try again button would only flash before the redirect lands. A retry in
  // flight shows the spinner rather than the error it is replacing.
  if (
    detailQuery.isError &&
    !detailQuery.isFetching &&
    !isAuthHandled(detailQuery.error)
  ) {
    const { refetch } = detailQuery
    return {
      status: 'error',
      system: undefined,
      retry: () => void refetch(),
    }
  }
  return { status: 'resolving', system: undefined }
}

export default useResolvedSystem
