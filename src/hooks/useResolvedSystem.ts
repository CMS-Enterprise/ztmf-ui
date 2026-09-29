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
  } | null>(null)

  useEffect(() => {
    if (listed || !fismaSystemsLoaded || !validId) return
    const listAtStart = fismaSystems
    const controller = new AbortController()
    const load = async () => {
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
      } catch {
        // A cancelled request is not an answer. Anything else, including a
        // 5xx or network failure, resolves to not-found: the page cannot tell
        // "missing" from "unreachable", so its copy covers both.
        if (controller.signal.aborted) return
      } finally {
        if (!controller.signal.aborted) {
          setSettled({ id: systemId, list: listAtStart })
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
  ])

  if (listed) return { status: 'found', system: listed }
  if (!validId) return { status: 'not-found', system: undefined }
  if (
    fismaSystemsLoaded &&
    settled?.id === systemId &&
    settled.list === fismaSystems
  ) {
    return { status: 'not-found', system: undefined }
  }
  return { status: 'resolving', system: undefined }
}

export default useResolvedSystem
