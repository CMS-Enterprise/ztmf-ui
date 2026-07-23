import type { UserRole } from '@/types'
import {
  hasAdminRead,
  hasSystemAccess,
  hasUnscopedRead,
  isAdmin,
  isAdminTierRole,
  isHHSTier,
  isISSO,
  isOpDivTier,
  isReadOnlyAdmin,
  isReadOnlyAdminRole,
  isSystemDelegate,
  isSystemScoped,
  isWriteAdminRole,
  selectableRoles,
} from '@/utils/userRoles'

/**
 * Regression contract for the multi-OpDiv role taxonomy.
 *
 * Stage 1 of the migration kept the legacy `ADMIN` and `READONLY_ADMIN`
 * role values valid alongside the new tiers so the frontend can render
 * correctly against both the pre-migration backend and the paired
 * backend. These tests pin that contract until Stage D drops the legacy
 * values from the backend enum. When that work lands, the legacy rows
 * below should be removed in the same PR — failing tests are the signal
 * that an intentional decision is required, not an error to suppress.
 */

const roleUser = (role: UserRole) => ({ role })

type Case = [role: UserRole, expected: boolean]

const isAdminCases: Case[] = [
  ['OWNER', true],
  ['HHS_ADMIN', true],
  ['OPDIV_ADMIN', true],
  ['ADMIN', true], // legacy, removed in Stage D
  ['HHS_READONLY_ADMIN', false],
  ['OPDIV_READONLY_ADMIN', false],
  ['READONLY_ADMIN', false], // legacy, removed in Stage D
  ['ISSO', false],
  ['ISSM', false],
  ['SYSTEM_DELEGATE', false],
]

const isReadOnlyAdminCases: Case[] = [
  ['HHS_READONLY_ADMIN', true],
  ['OPDIV_READONLY_ADMIN', true],
  ['READONLY_ADMIN', true], // legacy, removed in Stage D
  ['OWNER', false],
  ['HHS_ADMIN', false],
  ['OPDIV_ADMIN', false],
  ['ADMIN', false],
  ['ISSO', false],
  ['ISSM', false],
  ['SYSTEM_DELEGATE', false],
]

const hasUnscopedReadCases: Case[] = [
  ['OWNER', true],
  ['HHS_ADMIN', true],
  ['HHS_READONLY_ADMIN', true],
  ['ADMIN', true], // legacy, removed in Stage D
  ['READONLY_ADMIN', true], // legacy, removed in Stage D
  ['OPDIV_ADMIN', false],
  ['OPDIV_READONLY_ADMIN', false],
  ['ISSO', false],
  ['ISSM', false],
  ['SYSTEM_DELEGATE', false],
]

const hasSystemAccessCases: Case[] = [
  ['OWNER', true],
  ['HHS_ADMIN', true],
  ['HHS_READONLY_ADMIN', true],
  ['OPDIV_ADMIN', true],
  ['OPDIV_READONLY_ADMIN', true],
  ['ADMIN', true], // legacy, removed in Stage D
  ['READONLY_ADMIN', true], // legacy, removed in Stage D
  ['ISSO', true],
  ['ISSM', true],
  ['SYSTEM_DELEGATE', true],
]

const isHHSTierCases: Case[] = [
  ['HHS_ADMIN', true],
  ['HHS_READONLY_ADMIN', true],
  ['OWNER', false],
  ['OPDIV_ADMIN', false],
  ['OPDIV_READONLY_ADMIN', false],
  ['ISSO', false],
  ['ISSM', false],
  ['ADMIN', false], // legacy is CMS-tenant pre-migration, not HHS tier
  ['READONLY_ADMIN', false],
  ['SYSTEM_DELEGATE', false],
]

const isOpDivTierCases: Case[] = [
  ['OPDIV_ADMIN', true],
  ['OPDIV_READONLY_ADMIN', true],
  ['OWNER', false],
  ['HHS_ADMIN', false],
  ['HHS_READONLY_ADMIN', false],
  ['ISSO', false],
  ['ISSM', false],
  ['ADMIN', false],
  ['READONLY_ADMIN', false],
  ['SYSTEM_DELEGATE', false],
]

test.each(isAdminCases)('isAdmin(%s) === %s', (role, expected) => {
  expect(isAdmin(roleUser(role))).toBe(expected)
  expect(isWriteAdminRole(role)).toBe(expected)
})

test.each(isReadOnlyAdminCases)(
  'isReadOnlyAdmin(%s) === %s',
  (role, expected) => {
    expect(isReadOnlyAdmin(roleUser(role))).toBe(expected)
    expect(isReadOnlyAdminRole(role)).toBe(expected)
  }
)

test('hasAdminRead is the union of isAdmin and isReadOnlyAdmin', () => {
  const allRoles: UserRole[] = [
    'OWNER',
    'HHS_ADMIN',
    'HHS_READONLY_ADMIN',
    'OPDIV_ADMIN',
    'OPDIV_READONLY_ADMIN',
    'ISSO',
    'ISSM',
    'ADMIN',
    'READONLY_ADMIN',
  ]
  allRoles.forEach((role) => {
    const user = roleUser(role)
    expect(hasAdminRead(user)).toBe(isAdmin(user) || isReadOnlyAdmin(user))
  })
})

test.each(hasUnscopedReadCases)(
  'hasUnscopedRead(%s) === %s',
  (role, expected) => {
    expect(hasUnscopedRead(roleUser(role))).toBe(expected)
  }
)

test.each(hasSystemAccessCases)(
  'hasSystemAccess(%s) === %s',
  (role, expected) => {
    expect(hasSystemAccess(roleUser(role))).toBe(expected)
  }
)

test.each(isHHSTierCases)('isHHSTier(%s) === %s', (role, expected) => {
  expect(isHHSTier(roleUser(role))).toBe(expected)
})

test.each(isOpDivTierCases)('isOpDivTier(%s) === %s', (role, expected) => {
  expect(isOpDivTier(roleUser(role))).toBe(expected)
})

test('HHS and OpDiv tiers are mutually exclusive', () => {
  const allRoles: UserRole[] = [
    'OWNER',
    'HHS_ADMIN',
    'HHS_READONLY_ADMIN',
    'OPDIV_ADMIN',
    'OPDIV_READONLY_ADMIN',
    'ISSO',
    'ISSM',
    'ADMIN',
    'READONLY_ADMIN',
  ]
  allRoles.forEach((role) => {
    const user = roleUser(role)
    expect(isHHSTier(user) && isOpDivTier(user)).toBe(false)
  })
})

test('isAdminTierRole returns true for every admin tier (write or read-only)', () => {
  const adminTiers: UserRole[] = [
    'OWNER',
    'HHS_ADMIN',
    'OPDIV_ADMIN',
    'HHS_READONLY_ADMIN',
    'OPDIV_READONLY_ADMIN',
    'ADMIN', // legacy, removed in Stage D
    'READONLY_ADMIN', // legacy, removed in Stage D
  ]
  adminTiers.forEach((role) => {
    expect(isAdminTierRole(role)).toBe(true)
  })

  const nonAdmin: UserRole[] = ['ISSO', 'ISSM', 'SYSTEM_DELEGATE']
  nonAdmin.forEach((role) => {
    expect(isAdminTierRole(role)).toBe(false)
  })
})

// SYSTEM_DELEGATE is the frontend mirror of the backend answers-only carve-out
// (ztmf#455): it gets system-detail access exactly like ISSO/ISSM, but is
// barred from the target-maturity edit control. hasSystemAccess and
// isSystemScoped must therefore diverge for this role — that divergence is the
// whole point of the role, so pin it explicitly.
test('SYSTEM_DELEGATE has system access but is NOT system-scoped (answers-only)', () => {
  const delegate = roleUser('SYSTEM_DELEGATE')
  expect(hasSystemAccess(delegate)).toBe(true)
  expect(isSystemScoped(delegate)).toBe(false)
})

test('ISSO and ISSM remain both system-accessible and system-scoped', () => {
  ;(['ISSO', 'ISSM'] as UserRole[]).forEach((role) => {
    const user = roleUser(role)
    expect(hasSystemAccess(user)).toBe(true)
    expect(isSystemScoped(user)).toBe(true)
  })
})

// isSystemDelegate gates the delegate self-service surface's "hide from
// delegates" rule; only the delegate role qualifies.
const isSystemDelegateCases: Case[] = [
  ['SYSTEM_DELEGATE', true],
  ['ISSO', false],
  ['ISSM', false],
  ['OWNER', false],
  ['OPDIV_ADMIN', false],
]
test.each(isSystemDelegateCases)(
  'isSystemDelegate(%s) === %s',
  (role, expected) => {
    expect(isSystemDelegate(roleUser(role))).toBe(expected)
  }
)

// isISSO is split out from isSystemScoped (which also covers ISSM) so the
// delegate section can gate MANAGE controls to ISSO + admin while ISSM stays
// read-only. It must be true for ISSO alone among the system-scoped tiers.
const isISSOCases: Case[] = [
  ['ISSO', true],
  ['ISSM', false],
  ['SYSTEM_DELEGATE', false],
  ['OWNER', false],
  ['OPDIV_ADMIN', false],
]
test.each(isISSOCases)('isISSO(%s) === %s', (role, expected) => {
  expect(isISSO(roleUser(role))).toBe(expected)
})

test('isISSO and isSystemDelegate reject null, undefined, and placeholder', () => {
  const placeholder = { role: '' as UserRole }
  ;[null, undefined, placeholder].forEach((user) => {
    expect(isISSO(user)).toBe(false)
    expect(isSystemDelegate(user)).toBe(false)
  })
})

// The role dropdown when adding/editing a user is driven by selectableRoles,
// narrowed to the acting admin's tier. A delegate must be assignable by every
// admin tier that can assign the sibling ISSO/ISSM roles.
test.each(['OWNER', 'ADMIN', 'HHS_ADMIN', 'OPDIV_ADMIN'])(
  'selectableRoles(%s) offers SYSTEM_DELEGATE',
  (actor) => {
    expect(selectableRoles(actor)).toContain('SYSTEM_DELEGATE')
  }
)

test('all helpers reject null, undefined, and empty-role placeholder users', () => {
  const placeholder = { role: '' as UserRole }
  ;[null, undefined, placeholder].forEach((user) => {
    expect(isAdmin(user)).toBe(false)
    expect(isReadOnlyAdmin(user)).toBe(false)
    expect(hasAdminRead(user)).toBe(false)
    expect(hasUnscopedRead(user)).toBe(false)
    expect(hasSystemAccess(user)).toBe(false)
    expect(isHHSTier(user)).toBe(false)
    expect(isOpDivTier(user)).toBe(false)
  })
})

test('role-string helpers reject unknown strings', () => {
  const unknown = ['', 'admin', 'SUPERUSER', 'OPDIV-ADMIN', 'OWNERS']
  unknown.forEach((role) => {
    expect(isWriteAdminRole(role)).toBe(false)
    expect(isReadOnlyAdminRole(role)).toBe(false)
    expect(isAdminTierRole(role)).toBe(false)
  })
})
