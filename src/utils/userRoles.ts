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

const SYSTEM_SCOPED_ROLES = new Set<UserRole>(['ISSO', 'ISSM'])

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

// Row-level OpDiv scoping is server-enforced - the backend narrows the
// fismaSystems list before it reaches the frontend, so this gate only needs
// to decide whether the user belongs to a tier that gets system-detail UI at
// all (any admin tier + ISSO/ISSM).
export const hasSystemAccess = (user: UserLike): boolean =>
  hasAdminRead(user) ||
  (!!user && SYSTEM_SCOPED_ROLES.has(user.role as UserRole))

// Tier membership checks mirror the backend's IsHHSTier and IsOpDivTier
// helpers. Both cover the read-only variant of the tier, so callers must
// not use these as a write gate - use isAdmin for that. Stage 2+ UI work
// (OpDiv badges, scoped admin panels) will be the first consumer.
export const isHHSTier = (user: UserLike): boolean =>
  !!user && (user.role === 'HHS_ADMIN' || user.role === 'HHS_READONLY_ADMIN')

export const isOpDivTier = (user: UserLike): boolean =>
  !!user &&
  (user.role === 'OPDIV_ADMIN' || user.role === 'OPDIV_READONLY_ADMIN')
