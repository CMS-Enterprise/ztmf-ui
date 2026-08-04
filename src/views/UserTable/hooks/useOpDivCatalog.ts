import { useEffect, useState } from 'react'
import { fetchOpDivs } from '@/utils/opdivs'
import { isOpDivTier } from '@/utils/userRoles'
import type { OpDiv, userData } from '@/types'

/**
 * Loads the OpDiv catalog used by the Users table - one fetch, two
 * projections:
 *
 *   1. `opdivCodeMap` - id -> code for every OpDiv on file (incl. inactive
 *      / parent). Lets the OpDivs column resolve any granted id to a
 *      human-readable code even when the org has since deactivated it.
 *   2. `opdivOptions` - the assignable subset for the grant modal: active,
 *      non-parent rows, further narrowed to the actor's own OpDivs when the
 *      actor sits in an OpDiv tier. The server enforces the same rule.
 *   3. `opdivLabelMap` - id -> { code, name } for every OpDiv on file
 *      (incl. parent/inactive), so the grant modal can label grants to
 *      non-assignable OpDivs, which are absent from its scoped options.
 *
 * Skips the fetch entirely when the actor is not an admin (read-only users
 * never see the grant modal). On failure, both projections fall back to
 * empty so the table renders without crashing.
 * @param {boolean} isAdmin - Whether the actor can manage OpDiv grants.
 * @param {userData} userInfo - The actor's own profile; needed to narrow
 *   the assignable subset for OpDivAdmins.
 * @returns {{ opdivOptions: OpDiv[], opdivCodeMap: Record<number, string>,
 *   opdivLabelMap: Record<number, { code: string, name: string }> }}
 *   The three projections; all empty until the catalog loads.
 */
export function useOpDivCatalog(
  isAdmin: boolean,
  userInfo: userData
): {
  opdivOptions: OpDiv[]
  opdivCodeMap: Record<number, string>
  opdivLabelMap: Record<number, { code: string; name: string }>
} {
  const [opdivOptions, setOpDivOptions] = useState<OpDiv[]>([])
  const [opdivCodeMap, setOpDivCodeMap] = useState<Record<number, string>>({})
  const [opdivLabelMap, setOpDivLabelMap] = useState<
    Record<number, { code: string; name: string }>
  >({})

  useEffect(() => {
    if (!isAdmin) return
    async function loadOpDivs() {
      try {
        const all = await fetchOpDivs(true)
        const codeMap: Record<number, string> = {}
        const labelMap: Record<number, { code: string; name: string }> = {}
        all.forEach((od) => {
          codeMap[od.opdiv_id] = od.code
          labelMap[od.opdiv_id] = { code: od.code, name: od.name }
        })
        setOpDivCodeMap(codeMap)
        setOpDivLabelMap(labelMap)

        let assignable = all.filter((od) => !od.is_parent && od.active)
        if (isOpDivTier(userInfo)) {
          const own = new Set(userInfo.assignedopdivids ?? [])
          assignable = assignable.filter((od) => own.has(od.opdiv_id))
        }
        setOpDivOptions(assignable)
      } catch {
        // Non-fatal: the grant modal simply shows no options if this fails.
        setOpDivOptions([])
        setOpDivCodeMap({})
        setOpDivLabelMap({})
      }
    }
    loadOpDivs()
  }, [isAdmin, userInfo])

  return { opdivOptions, opdivCodeMap, opdivLabelMap }
}
