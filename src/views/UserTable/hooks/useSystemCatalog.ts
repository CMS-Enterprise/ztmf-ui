import { useEffect, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import { isAuthHandled } from '@/utils/notify'
import type { FismaSystemType } from '@/types'

/**
 * Loads the global fisma-system metadata the Assign Systems modal labels
 * from: the active list (labels cross-OpDiv orphan assignments) and the
 * decommissioned list (adds the "(Decommissioned)" flag for retired-system
 * rows). Fetched once per table mount and passed down so opening the modal
 * only costs its two per-user reads.
 *
 * Both reads are label sources only, so a failure is non-fatal: the picker
 * still offers the right options from the per-user assignable response and
 * in-scope rows still label correctly.
 * @param {boolean} enabled - Whether the actor can open the assign modal;
 *   skips the fetches entirely for read-only users.
 * @returns {{ allSystems: FismaSystemType[], decommSystems: FismaSystemType[] }}
 *   The two lists; both empty until the catalog loads (or on failure).
 */
export function useSystemCatalog(enabled: boolean): {
  allSystems: FismaSystemType[]
  decommSystems: FismaSystemType[]
} {
  const [allSystems, setAllSystems] = useState<FismaSystemType[]>([])
  const [decommSystems, setDecommSystems] = useState<FismaSystemType[]>([])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    async function loadFismaSystems() {
      const [activeRes, decommRes] = await Promise.allSettled([
        axiosInstance.get<{ data: FismaSystemType[] | null }>('/fismasystems', {
          signal: controller.signal,
        }),
        axiosInstance.get<{ data: FismaSystemType[] | null }>(
          '/fismasystems?decommissioned=true',
          { signal: controller.signal }
        ),
      ])
      if (controller.signal.aborted) return
      if (activeRes.status === 'fulfilled') {
        setAllSystems(activeRes.value.data.data ?? [])
      } else if (!isAuthHandled(activeRes.reason)) {
        console.error('Fetch active fisma systems failed:', activeRes.reason)
      }
      if (decommRes.status === 'fulfilled') {
        setDecommSystems(decommRes.value.data.data ?? [])
      } else if (!isAuthHandled(decommRes.reason)) {
        console.warn(
          'Fetch decommissioned fisma systems failed; decommissioned assignments will render without a "(Decommissioned)" suffix until the next refresh:',
          decommRes.reason
        )
      }
    }
    loadFismaSystems()
    return () => {
      controller.abort()
    }
  }, [enabled])

  return { allSystems, decommSystems }
}
