/**
 * Who covers an OpDiv, and where the coverage is thin.
 *
 * One rule shapes this whole module: **an OpDiv grant is the scope only for
 * OpDiv-tier roles.** An ISSO or ISSM can carry a grant left over from an
 * earlier seed that the backend deliberately ignores when deciding what they
 * can see, so counting ISSOs by `assignedopdivids` would report people who
 * have no access to the OpDiv's systems at all. So the role breakdown covers
 * admin tiers only, and ISSO coverage is derived from the systems themselves,
 * which is both accurate and free of extra requests.
 *
 * @module views/OpDivDashboard/opdivPeople
 */
import { isOpDivTier } from '@/utils/userRoles'
import type { UserRole, users } from '@/types'

/** Admin tiers whose scope an OpDiv grant genuinely describes. */
const ADMIN_TIER_ROLES: UserRole[] = [
  'OWNER',
  'HHS_ADMIN',
  'HHS_READONLY_ADMIN',
  'OPDIV_ADMIN',
  'OPDIV_READONLY_ADMIN',
]

/** Days ahead that count as "expiring soon". */
const EXPIRY_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Users holding a grant on this OpDiv, excluding deleted accounts.
 * @param {users[]} all - The user list.
 * @param {number} opdivId - The OpDiv.
 * @returns {users[]} Grant holders.
 */
export function usersForOpDiv(all: users[], opdivId: number): users[] {
  return all.filter(
    (u) => !u.deleted && (u.assignedopdivids ?? []).includes(opdivId)
  )
}

/** One role's headcount in an OpDiv. */
export type RoleCount = { role: UserRole; count: number }

/**
 * Admin-tier headcount for an OpDiv, in tier order.
 *
 * Deliberately excludes ISSO/ISSM/SYSTEM_DELEGATE: for those roles a grant is
 * not the scope, so a count would overstate coverage.
 * @param {users[]} scoped - Users holding a grant on the OpDiv.
 * @returns {RoleCount[]} Non-zero admin-tier counts, in tier order.
 */
export function adminTierCounts(scoped: users[]): RoleCount[] {
  return ADMIN_TIER_ROLES.map((role) => ({
    role,
    count: scoped.filter((u) => u.role === role).length,
  })).filter((entry) => entry.count > 0)
}

/**
 * The OpDiv's admin-tier users, most privileged first then by name.
 *
 * Named rather than counted: "Owner 8" tells nobody who to ask. Same tier
 * restriction as {@link adminTierCounts} - an ISSO's OpDiv grant is not their
 * scope, so listing them here would misrepresent who covers the OpDiv.
 * @param {users[]} scoped - Users holding a grant on the OpDiv.
 * @returns {users[]} Admin-tier users in tier order.
 */
export function adminTierRoster(scoped: users[]): users[] {
  return scoped
    .filter((u) => ADMIN_TIER_ROLES.includes(u.role))
    .sort(
      (a, b) =>
        ADMIN_TIER_ROLES.indexOf(a.role) - ADMIN_TIER_ROLES.indexOf(b.role) ||
        (a.fullname || a.email).localeCompare(b.fullname || b.email)
    )
}

/**
 * Whether an OpDiv grant actually determines this user's access scope.
 * @param {users} user - The user.
 * @returns {boolean} True for OpDiv-tier roles.
 */
export function grantIsScope(user: users): boolean {
  return isOpDivTier(user)
}

/** Delegates split by how close their access is to lapsing. */
export type DelegateExpiry = {
  expired: users[]
  expiringSoon: users[]
  active: users[]
}

/**
 * Classifies an OpDiv's system delegates by access expiry.
 *
 * A delegate row always carries a date - the backend constrains the column to
 * that role - so a null here means the access does not lapse, not that the
 * date is unknown.
 * @param {users[]} scoped - Users holding a grant on the OpDiv.
 * @param {Date} now - The reference time, injected so tests are deterministic.
 * @returns {DelegateExpiry} The three groups.
 */
export function classifyDelegateExpiry(
  scoped: users[],
  now: Date
): DelegateExpiry {
  const expired: users[] = []
  const expiringSoon: users[] = []
  const active: users[] = []

  for (const user of scoped) {
    if (user.role !== 'SYSTEM_DELEGATE') continue
    const raw = user.access_expires_at
    if (!raw) {
      active.push(user)
      continue
    }
    const at = new Date(raw).getTime()
    if (Number.isNaN(at)) {
      active.push(user)
      continue
    }
    const daysLeft = (at - now.getTime()) / MS_PER_DAY
    if (daysLeft < 0) expired.push(user)
    else if (daysLeft <= EXPIRY_WINDOW_DAYS) expiringSoon.push(user)
    else active.push(user)
  }

  return { expired, expiringSoon, active }
}
