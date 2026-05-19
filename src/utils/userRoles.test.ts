import type { UserRole } from '@/types'
import {
  hasAdminRead,
  hasSystemAccess,
  hasUnscopedRead,
  isAdmin,
  isAdminTierRole,
  isHHSTier,
  isOpDivTier,
  isReadOnlyAdmin,
  isReadOnlyAdminRole,
  isWriteAdminRole,
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

  const nonAdmin: UserRole[] = ['ISSO', 'ISSM']
  nonAdmin.forEach((role) => {
    expect(isAdminTierRole(role)).toBe(false)
  })
})

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
