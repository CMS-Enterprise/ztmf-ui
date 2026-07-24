import type { userData, UserRole } from '@/types'

const WRITE_ADMIN_ROLES = new Set<UserRole>([
  'OWNER',
  'HHS_ADMIN',
  'OPDIV_ADMIN',
  'ADMIN', // legacy, removed in Stage D
])

const READ_ONLY_ADMIN_ROLES = new Set<UserRole>([
  'HHS_READONLY_ADMIN',
  'OPDIV_READONLY_ADMIN',
  'READONLY_ADMIN', // legacy, removed in Stage D
])

const UNSCOPED_READ_ROLES = new Set<UserRole>([
  'OWNER',
  'HHS_ADMIN',
  'HHS_READONLY_ADMIN',
  'ADMIN', // legacy, removed in Stage D
  'READONLY_ADMIN', // legacy, removed in Stage D
])

// Two distinct system concepts, deliberately kept separate:
//   SYSTEM_ACCESS_ROLES - tiers that get system-detail UI (dashboard, system
//     pages). Includes SYSTEM_DELEGATE.
//   SYSTEM_SCOPED_ROLES - tiers allowed to edit a system's target maturity.
//     Excludes SYSTEM_DELEGATE: a delegate is answers-only, barred from the
//     target-maturity control (mirrors the backend carve-out for ztmf#455).
// A delegate has access but is not "scoped" for the target-maturity write.
const SYSTEM_ACCESS_ROLES = new Set<UserRole>([
  'ISSO',
  'ISSM',
  'SYSTEM_DELEGATE',
])

const SYSTEM_SCOPED_ROLES = new Set<UserRole>(['ISSO', 'ISSM'])

// Roles an admin may assign, narrowed by the acting admin's own tier so the
// dropdown can never offer a privilege escalation. Legacy ADMIN / READONLY_ADMIN
// are excluded everywhere: the backend already dropped them (migration 0040 /
// ztmf#314) and only accepts the new taxonomy.
//
// These lists are display gating only. The backend SaveUser escalation guard is
// the security boundary and must enforce the same matrix - only OWNER assigns
// OWNER, HHS_ADMIN cannot mint OWNER, OPDIV_ADMIN stays at/below OpDiv tier - so
// a crafted request that bypasses the dropdown is still rejected.

// OWNER (platform/dev) may assign any tier, including OWNER.
const OWNER_ASSIGNABLE_ROLES: UserRole[] = [
  'OWNER',
  'HHS_ADMIN',
  'HHS_READONLY_ADMIN',
  'OPDIV_ADMIN',
  'OPDIV_READONLY_ADMIN',
  'ISSO',
  'ISSM',
  'SYSTEM_DELEGATE',
]

// HHS_ADMIN sits below OWNER, so it may assign everything except OWNER.
const HHS_ASSIGNABLE_ROLES: UserRole[] = [
  'HHS_ADMIN',
  'HHS_READONLY_ADMIN',
  'OPDIV_ADMIN',
  'OPDIV_READONLY_ADMIN',
  'ISSO',
  'ISSM',
  'SYSTEM_DELEGATE',
]

// An OPDIV_ADMIN cannot mint OWNER/HHS tiers - they may only assign roles at
// or below their own OpDiv scope.
const OPDIV_ASSIGNABLE_ROLES: UserRole[] = [
  'OPDIV_ADMIN',
  'OPDIV_READONLY_ADMIN',
  'ISSO',
  'ISSM',
  'SYSTEM_DELEGATE',
]

type UserLike = Pick<userData, 'role'> | null | undefined

export const isWriteAdminRole = (role: string): boolean =>
  WRITE_ADMIN_ROLES.has(role as UserRole)

export const isReadOnlyAdminRole = (role: string): boolean =>
  READ_ONLY_ADMIN_ROLES.has(role as UserRole)

export const isAdminTierRole = (role: string): boolean =>
  isWriteAdminRole(role) || isReadOnlyAdminRole(role)

export const isAdmin = (user: UserLike): boolean =>
  !!user && isWriteAdminRole(user.role)

export const isReadOnlyAdmin = (user: UserLike): boolean =>
  !!user && isReadOnlyAdminRole(user.role)

export const hasAdminRead = (user: UserLike): boolean =>
  isAdmin(user) || isReadOnlyAdmin(user)

export const hasUnscopedRead = (user: UserLike): boolean =>
  !!user && UNSCOPED_READ_ROLES.has(user.role as UserRole)

// System-scoped tiers (ISSO / ISSM) - the users whose write scope is their
// per-system assignment rather than an OpDiv or admin tier. Like the other
// gates here this is display-only: the backend narrows the fismaSystems list
// to the user's assignments and re-checks IsAssignedFismaSystem on write, so
// the frontend only needs the tier. Read-only admins are deliberately excluded
// (they are neither admin-writers nor system-scoped).
export const isSystemScoped = (user: UserLike): boolean =>
  !!user && SYSTEM_SCOPED_ROLES.has(user.role as UserRole)

// A system delegate - answers-only, and the one tier the delegate
// self-service surface is hidden from (a delegate cannot manage delegates).
export const isSystemDelegate = (user: UserLike): boolean =>
  !!user && user.role === 'SYSTEM_DELEGATE'

// ISSO specifically, split out from isSystemScoped (which also covers ISSM).
// The delegate self-service actor scope is ISSO-only among non-admins (epic
// decision 5), so ISSM sees the roster read-only while ISSO can manage it.
export const isISSO = (user: UserLike): boolean =>
  !!user && user.role === 'ISSO'

// Row-level OpDiv scoping is server-enforced - the backend narrows the
// fismaSystems list before it reaches the frontend, so this gate only needs
// to decide whether the user belongs to a tier that gets system-detail UI at
// all (any admin tier + ISSO/ISSM/SYSTEM_DELEGATE). Uses SYSTEM_ACCESS_ROLES,
// not SYSTEM_SCOPED_ROLES: a delegate gets the system UI but is not
// target-maturity-scoped (see isSystemScoped).
export const hasSystemAccess = (user: UserLike): boolean =>
  hasAdminRead(user) ||
  (!!user && SYSTEM_ACCESS_ROLES.has(user.role as UserRole))

// Tier membership checks mirror the backend's IsHHSTier and IsOpDivTier
// helpers. Both cover the read-only variant of the tier, so callers must
// not use these as a write gate - use isAdmin for that. Stage 2+ UI work
// (OpDiv badges, scoped admin panels) will be the first consumer.
export const isHHSTier = (user: UserLike): boolean =>
  !!user && (user.role === 'HHS_ADMIN' || user.role === 'HHS_READONLY_ADMIN')

// Unscoped write admins (OWNER / HHS_ADMIN, plus the legacy ADMIN that maps to
// OWNER). These are the only tiers the backend lets act across all OpDivs for
// privileged, non-scoped actions like mass email. OpDiv-scoped and read-only
// admins are excluded and would get a 403.
export const isUnscopedWriteAdmin = (user: UserLike): boolean =>
  !!user &&
  (user.role === 'OWNER' || user.role === 'HHS_ADMIN' || user.role === 'ADMIN')

export const isOpDivTier = (user: UserLike): boolean =>
  !!user &&
  (user.role === 'OPDIV_ADMIN' || user.role === 'OPDIV_READONLY_ADMIN')

// The set of roles the acting admin is allowed to grant, scoped to their tier:
// OWNER -> any tier; HHS_ADMIN -> any except OWNER; OPDIV_ADMIN -> OpDiv tier and
// below. The legacy ADMIN carryover mapped to OWNER, so it gets the OWNER set.
// Read-only admins cannot assign at all.
export const selectableRoles = (actorRole: string): UserRole[] => {
  if (actorRole === 'OWNER' || actorRole === 'ADMIN')
    return [...OWNER_ASSIGNABLE_ROLES]
  if (actorRole === 'HHS_ADMIN') return [...HHS_ASSIGNABLE_ROLES]
  if (actorRole === 'OPDIV_ADMIN') return [...OPDIV_ASSIGNABLE_ROLES]
  return []
}
