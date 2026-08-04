import { useEffect, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import { fetchUserOpDivs } from '@/utils/userOpdivs'
import { isAuthHandled, notify } from '@/utils/notify'
import { ERROR_MESSAGES } from '@/constants'
import type { users } from '@/types'

/**
 * Loads the Users table dataset and exposes the two pieces of state the
 * grid renders:
 *
 *   1. `rows` - the /users response, role-trimmed.
 *   2. `userOpDivMap` - per-user OpDiv grants. Used as a refresh override
 *      after the inline grant/revoke or the grant modal closes. Backfilled
 *      from the per-user detail endpoint only when the list response does
 *      not include `assignedopdivids` inline (older backend compatibility).
 *
 * Re-fetches on canRead / showDeleted changes. The effect aborts on unmount
 * and also flags an internal abort signal for the per-user backfill
 * Promise.all, which has no AbortController of its own.
 *
 * The mutating CRUD callbacks (processRowUpdate, delete, restore, inline
 * grant/revoke) stay in the parent component because they call into the
 * snackbar/notify helpers that live there; the setters returned here are
 * what they mutate.
 * @param {{ canRead: boolean, showDeleted: boolean }} args - Inputs that
 *   drive the fetch.
 * @returns {{
 *   rows: users[],
 *   setRows: React.Dispatch<React.SetStateAction<users[]>>,
 *   userOpDivMap: Record<string, number[]>,
 *   setUserOpDivMap: React.Dispatch<
 *     React.SetStateAction<Record<string, number[]>>
 *   >,
 * }} Loaded state + the setters the CRUD callbacks mutate.
 */
export function useLoadUsers({
  canRead,
  showDeleted,
}: {
  canRead: boolean
  showDeleted: boolean
}) {
  const [rows, setRows] = useState<users[]>([])
  const [userOpDivMap, setUserOpDivMap] = useState<Record<string, number[]>>({})

  useEffect(() => {
    if (!canRead) return
    const controller = new AbortController()
    // backfillAborted guards the Promise.all per-user calls, which can't
    // receive a signal since fetchUserOpDivs doesn't accept one.
    let backfillAborted = false
    async function load() {
      try {
        const res = await axiosInstance.get('/users', {
          params: { deleted: showDeleted },
          signal: controller.signal,
        })
        if (res.status !== 200) return
        const data = res.data.data.map((row: users) => ({
          ...row,
          role: row.role.trim(),
        }))
        setRows(data)
        // Grants now arrive inline on each list row (assignedopdivids), so
        // the OpDivs column reads them directly with no per-user calls.
        // Fall back to the per-user detail endpoint only against an older
        // backend that omits them, keeping this safe to ship before or
        // after the backend deploys. Distinguish "old backend omitted the
        // field" (key absent -> backfill) from "new backend, user simply
        // has zero grants" (key present, value null/[] -> no backfill).
        // A value check would misfire on every zero-grant user and re-
        // introduce the N+1.
        const missingInlineGrants = data.some(
          (u: users) => !('assignedopdivids' in u)
        )
        if (missingInlineGrants) {
          try {
            const entries = await Promise.all(
              data.map((u: users) =>
                fetchUserOpDivs(u.userid)
                  .then((ids) => [u.userid, ids] as [string, number[]])
                  .catch(() => [u.userid, []] as [string, number[]])
              )
            )
            if (backfillAborted) return
            // Merge rather than replace so an in-flight per-user refresh
            // (e.g. from closing the grant modal) is not clobbered.
            setUserOpDivMap((prev) => ({
              ...prev,
              ...Object.fromEntries(entries),
            }))
          } catch (error) {
            if (backfillAborted) return
            // The per-user catches above already default to [], so this
            // only trips on an unexpected failure. Surface it rather than
            // leaving the OpDivs column silently blank.
            console.error('Failed to backfill OpDiv grants', error)
            notify(ERROR_MESSAGES.tryAgain, 'warning')
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Fetch users error:', error)
        notify(ERROR_MESSAGES.tryAgain, 'error')
      }
    }
    load()
    return () => {
      controller.abort()
      backfillAborted = true
    }
  }, [canRead, showDeleted])

  return { rows, setRows, userOpDivMap, setUserOpDivMap }
}
