// The four views UserTable derives from the shared OpDiv list. Pure so they
// can be tested without rendering the grid; the column definitions that
// consume them are pinned separately in UserTable.test.tsx. The caller-scope
// narrowing below is a rule, not a transform, so it needs pinning either way.
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

/**
 * Options for the roster's OpDiv filter facet. Wider than the assignable set:
 * filtering is a read, so it covers read-only admins and the HHS parent, and
 * the active selection (e.g. an inactive OpDiv from a deep link) is always an
 * option so the facet can show it and clear it.
 */
export function buildFilterOpDivs(
  opdivs: OpDiv[],
  userInfo: userData,
  selected: number | 'all'
): OpDiv[] {
  const options = narrowToCallerScope(
    opdivs.filter((od) => od.active),
    userInfo
  )
  if (selected !== 'all' && !options.some((od) => od.opdiv_id === selected)) {
    const known = opdivs.find((od) => od.opdiv_id === selected)
    options.push(
      known ?? {
        opdiv_id: selected,
        code: `#${selected}`,
        name: 'Unknown OpDiv',
        is_parent: false,
        active: false,
        system_delegate_enabled: false,
      }
    )
  }
  return options.sort((a, b) => a.code.localeCompare(b.code))
}
