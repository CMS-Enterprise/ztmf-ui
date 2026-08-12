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
 * @returns {{ opdivOptions: OpDiv[], allAssignableOpDivs: OpDiv[],
 *   opdivCodeMap: Record<number, string>,
 *   opdivLabelMap: Record<number, { code: string, name: string }> }}
 *   The three projections; all empty until the catalog loads.
 */
export function useOpDivCatalog(
  isAdmin: boolean,
  userInfo: userData
): {
  opdivOptions: OpDiv[]
  allAssignableOpDivs: OpDiv[]
  opdivCodeMap: Record<number, string>
  opdivLabelMap: Record<number, { code: string; name: string }>
} {
  const [opdivOptions, setOpDivOptions] = useState<OpDiv[]>([])
  const [opdivCodeMap, setOpDivCodeMap] = useState<Record<number, string>>({})
  const [opdivLabelMap, setOpDivLabelMap] = useState<
    Record<number, { code: string; name: string }>
  >({})
  // All assignable OpDivs (active, non-parent), NOT narrowed to the caller's
  // scope. The grant modal narrows this against the caller's fresh grants
  // itself, so it isn't fed the session-old scope that opdivOptions carries.
  const [allAssignableOpDivs, setAllAssignableOpDivs] = useState<OpDiv[]>([])

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

        const activeNonParent = all.filter((od) => !od.is_parent && od.active)
        setAllAssignableOpDivs(activeNonParent)

        // opdivOptions stays caller-narrowed for the inline OpDiv edit cell.
        // The grant modal does NOT use this; it narrows the full set against
        // the caller's fresh scope itself.
        let assignable = activeNonParent
        if (isOpDivTier(userInfo)) {
          const own = new Set(userInfo.assignedopdivids ?? [])
          assignable = assignable.filter((od) => own.has(od.opdiv_id))
        }
        setOpDivOptions(assignable)
      } catch {
        // Non-fatal: the grant modal simply shows no options if this fails.
        setOpDivOptions([])
        setAllAssignableOpDivs([])
        setOpDivCodeMap({})
        setOpDivLabelMap({})
      }
    }
    loadOpDivs()
  }, [isAdmin, userInfo])

  return { opdivOptions, allAssignableOpDivs, opdivCodeMap, opdivLabelMap }
}
