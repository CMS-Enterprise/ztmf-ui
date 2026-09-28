import { useEffect, useState } from 'react'
import axiosInstance from '@/axiosConfig'

/**
 * Resolves a userid to a display name via /users/{userid}.fullname when
 * the modal is open and the userid is set, otherwise an empty string.
 * Both the "decommissioned by" and "reactivated by" panels need exactly
 * this shape; this hook is called twice instead of having two identical
 * effects inline.
 *
 * The userid comparison inside the fetch guards against the late-resolve
 * race: if `system.<by>` changes while a request is in flight (e.g. the
 * modal swaps to a different row), the stale response is dropped instead
 * of contaminating the new system's row. The effect also aborts on close
 * / unmount via AbortController.
 *
 * On failure the userid itself is shown - the panel needs *some* label
 * for the audit row, and "unknown" would be worse than a raw id.
 * @param {string | null | undefined} userid - The user id to look up.
 *   Falsy values short-circuit to an empty string.
 * @param {boolean} enabled - When false (panel closed), the hook stays
 *   silent and returns ''.
 * @returns {string} The resolved fullname, the raw userid on failure,
 *   or '' until the request resolves or when disabled.
 */
export function useUserNameLookup(
  userid: string | null | undefined,
  enabled: boolean
): string {
  const [name, setName] = useState<string>('')

  useEffect(() => {
    if (!enabled || !userid) {
      setName('')
      return
    }
    const controller = new AbortController()
    const targetId = userid
    async function load() {
      try {
        const res = await axiosInstance.get(`users/${targetId}`, {
          signal: controller.signal,
        })
        // Guard the late-resolve race: only commit when the userid we
        // started this request for is still the one the caller wants.
        if (userid === targetId) {
          setName(res.data?.data?.fullname || targetId)
        }
      } catch {
        if (controller.signal.aborted) return
        if (userid === targetId) {
          setName(targetId)
        }
      }
    }
    load()
    return () => {
      controller.abort()
    }
  }, [userid, enabled])

  return name
}
