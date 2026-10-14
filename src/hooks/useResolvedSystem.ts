import { useEffect, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import { apiPaths } from '@/api/keys'
import { useContextProp } from '@/views/Title/Context'
import type { FismaSystemType } from '@/types'

/** Where a by-id system lookup stands. */
export type SystemResolution =
  | { status: 'resolving'; system: undefined }
  | { status: 'found'; system: FismaSystemType }
  | { status: 'not-found'; system: undefined }
  | { status: 'error'; system: undefined; retry: () => void }

// The API answers 403 for a system outside the caller's scope and 404 for one
// that does not exist. Both read as not-found so the page never reveals which.
const MISSING_STATUSES = new Set([403, 404])

/**
 * Resolves a system from its id for a page addressed by URL (System Detail,
 * Pillar Scores).
 *
 * The shared systems list only holds active systems, so a decommissioned
 * system or a stale deep link can be missing from it. When the id is not in
 * the list, the system is fetched once by id and added to the list. The wait
 * is keyed on `fismaSystemsLoaded`, not on the list being non-empty: a user
 * with no accessible systems has an empty list forever, and still needs to
 * reach a not-found state instead of an endless spinner.
 *
 *   const resolution = useResolvedSystem(systemId)
 *   if (resolution.status === 'resolving') return <Spinner />
 *   if (resolution.status === 'not-found') return <NotFound />
 *   const { system } = resolution
 *
 * A lookup that fails for any other reason (a 5xx, a network drop, a timeout)
 * resolves to `error` with a `retry`, not to not-found: the system may well
 * exist and be the caller's, so the page should not suggest otherwise.
 *
 * @param {number} systemId - The system id from the URL. A non-positive or
 *   non-numeric id resolves to not-found without a request.
 * @returns {SystemResolution} The lookup status and, once found, the system.
 */
export function useResolvedSystem(systemId: number): SystemResolution {
  const { fismaSystems, fismaSystemsLoaded, setFismaSystems } = useContextProp()
  const listed = fismaSystems.find((s) => s.fismasystemid === systemId)
  const validId = Number.isInteger(systemId) && systemId > 0
  // The last finished by-id lookup: which id, and the list it ran against. A
  // miss only counts for that same list. Navigating to another system, or a
  // refetch that replaces the list (after a save, say, when the system is
  // outside the current view), starts a fresh lookup instead of briefly
  // reading as not found.
  const [settled, setSettled] = useState<{
    id: number
    list: FismaSystemType[]
    failed: boolean
  } | null>(null)
  // Bumped by retry() to run the lookup again for the same id and list.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (listed || !fismaSystemsLoaded || !validId) return
    const listAtStart = fismaSystems
    const controller = new AbortController()
    const load = async () => {
      let failed = false
      try {
        const res = await axiosInstance.get(
          apiPaths.fismaSystems.detail(systemId),
          { signal: controller.signal }
        )
        const data: FismaSystemType | undefined = res.data?.data
        if (data) {
          setFismaSystems((prev) =>
            prev.some((s) => s.fismasystemid === data.fismasystemid)
              ? prev
              : [...prev, data]
          )
        }
      } catch (err) {
        // A cancelled request is not an answer.
        if (controller.signal.aborted) return
        const status = (err as { response?: { status?: number } })?.response
          ?.status
        failed = !(status !== undefined && MISSING_STATUSES.has(status))
      } finally {
        if (!controller.signal.aborted) {
          setSettled({ id: systemId, list: listAtStart, failed })
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [
    listed,
    fismaSystems,
    fismaSystemsLoaded,
    validId,
    systemId,
    setFismaSystems,
    attempt,
  ])

  if (listed) return { status: 'found', system: listed }
  if (!validId) return { status: 'not-found', system: undefined }
  if (
    fismaSystemsLoaded &&
    settled?.id === systemId &&
    settled.list === fismaSystems
  ) {
    if (settled.failed) {
      return {
        status: 'error',
        system: undefined,
        retry: () => {
          setSettled(null)
          setAttempt((n) => n + 1)
        },
      }
    }
    return { status: 'not-found', system: undefined }
  }
  return { status: 'resolving', system: undefined }
}

export default useResolvedSystem
