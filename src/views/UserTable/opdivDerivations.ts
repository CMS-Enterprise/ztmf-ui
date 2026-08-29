// The four views UserTable derives from the shared OpDiv list (#558). Pure so
// they can be tested without rendering the grid - UserTable itself has no
// render coverage, and the caller-scope narrowing below is a rule, not a
// transform, so it needs pinning.
import { isOpDivTier } from '@/utils/userRoles'
import type { OpDiv, userData } from '@/types'

/**
 * opdiv_id -> code, for the OpDivs membership column. Built from the full
 * list (incl. parent/inactive) so any granted id resolves to a code rather
 * than falling back to a bare number.
 */
export function buildOpDivCodeMap(opdivs: OpDiv[]): Record<number, string> {
  const map: Record<number, string> = {}
  opdivs.forEach((od) => {
    map[od.opdiv_id] = od.code
  })
  return map
}

/**
 * opdiv_id -> { code, name }, a full label source so the grant modal can label
 * grants to non-assignable OpDivs, which are absent from its options list.
 */
export function buildOpDivLabelMap(
  opdivs: OpDiv[]
): Record<number, { code: string; name: string }> {
  const map: Record<number, { code: string; name: string }> = {}
  opdivs.forEach((od) => {
    map[od.opdiv_id] = { code: od.code, name: od.name }
  })
  return map
}

/**
 * Every grantable OpDiv: active and not the HHS parent row, which is not a
 * tenant. NOT narrowed to the caller - the grant modal narrows this against
 * the caller's fresh grants itself. Empty for non-write-admins, who have no
 * grant affordance at all.
 */
export function buildAssignableOpDivs(
  opdivs: OpDiv[],
  isAdmin: boolean
): OpDiv[] {
  if (!isAdmin) return []
  return opdivs.filter((od) => !od.is_parent && od.active)
}

/**
 * Narrows the assignable set to the caller's own OpDivs for OPDIV-tier admins,
 * who may only grant what they hold; unscoped tiers keep the full set. Display
 * only - the server enforces the same rule on the write.
 */
export function narrowToCallerScope(
  assignable: OpDiv[],
  userInfo: userData
): OpDiv[] {
  if (!isOpDivTier(userInfo)) return assignable
  const own = new Set(userInfo.assignedopdivids ?? [])
  return assignable.filter((od) => own.has(od.opdiv_id))
}
