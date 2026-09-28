import { useEffect, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import { fetchUserOpDivs } from '@/utils/userOpdivs'
import { isAuthHandled, notify } from '@/utils/notify'
import { ERROR_MESSAGES } from '@/constants'
import type { users } from '@/types'

/**
 * Loads the Users table dataset and exposes the single piece of state the
 * grid renders and filters from: `rows`, the /users response (role-trimmed),
 * with `assignedopdivids` backfilled in place from the per-user detail
 * endpoint when the list response omits it (older backend compatibility).
 *
 * Rows are the one authoritative source for grants: both the OpDivs column
 * (renderCell) and the OpDiv filter read `row.assignedopdivids` directly, and
 * `refreshUserRow` (in the parent) patches that same field after a grant-modal
 * save or a new user's grant. A previous version kept the backfill in a
 * separate `userOpDivMap` that only the filter consulted, which let the
 * column and the filter disagree and went stale the moment `refreshUserRow`
 * updated the row but not the map.
 *
 * Re-fetches on canRead / showDeleted changes. The effect aborts on unmount
 * and also flags an internal abort signal for the per-user backfill
 * Promise.all, which has no AbortController of its own. The backfill merge is
 * race-safe: it only ever fills a row that still lacks `assignedopdivids`, so
 * a newer update to that row (e.g. `refreshUserRow` resolving first) always
 * wins over a late-arriving compatibility read.
 *
 * The mutating CRUD callbacks (processRowUpdate, delete, restore, inline
 * grant/revoke) stay in the parent component because they call into the
 * snackbar/notify helpers that live there; the setter returned here is what
 * they mutate.
 * @param {{ canRead: boolean, showDeleted: boolean }} args - Inputs that
 *   drive the fetch.
 * @returns {{
 *   rows: users[],
 *   setRows: React.Dispatch<React.SetStateAction<users[]>>,
 * }} Loaded rows + the setter the CRUD callbacks mutate.
 */
export function useLoadUsers({
  canRead,
  showDeleted,
}: {
  canRead: boolean
  showDeleted: boolean
}) {
  const [rows, setRows] = useState<users[]>([])

  useEffect(() => {
    if (!canRead) return
    const controller = new AbortController()
    // backfillAborted also guards state writes after cancellation; the shared
    // signal aborts the per-user requests themselves.
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
                fetchUserOpDivs(u.userid, controller.signal)
                  .then((ids) => [u.userid, ids] as [string, number[]])
                  .catch(() => [u.userid, []] as [string, number[]])
              )
            )
            if (backfillAborted) return
            const backfillMap = Object.fromEntries(entries) as Record<
              string,
              number[]
            >
            // Patch assignedopdivids onto the matching rows, but only where
            // it is still missing. A row that already carries the field by
            // the time this resolves picked it up from a newer update (a
            // grant-modal save via refreshUserRow, or a just-created row's
            // own grant) racing ahead of this compatibility read, and that
            // newer value must win rather than being clobbered here.
            setRows((prev) =>
              prev.map((row) =>
                row.userid in backfillMap && !('assignedopdivids' in row)
                  ? { ...row, assignedopdivids: backfillMap[row.userid] }
                  : row
              )
            )
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

  return { rows, setRows }
}
