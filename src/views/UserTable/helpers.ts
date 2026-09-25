/**
 * Pure helpers shared across the Users table view layer. Kept in their own
 * module so the extracted cells / toolbar / actions components don't have to
 * import from UserTable.tsx (which would create a cycle).
 */

/**
 * Initials taken from a full name (or email local-part if no name) - at most
 * two letters, uppercase. Falls back to "U" so the avatar circle never reads
 * empty. Splits on whitespace + the common ID separators (".", "_", "-") so
 * an email like `jane.doe@x.gov` yields "JD" without needing the user to
 * have a real name on file yet.
 *
 * @param {string | undefined} fullname - Display name; may be empty.
 * @param {string} email - Used as a fallback source of initials.
 * @returns {string} 1-2 character initials, uppercase.
 */
export function initialsFor(
  fullname: string | undefined,
  email: string
): string {
  const source = (fullname || email.split('@')[0] || '').trim()
  if (!source) return 'U'
  return (
    source
      .split(/\s+|[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  )
}

/**
 * Deterministic avatar background palette. Each color is picked from a
 * curated set, indexed by a stable hash of the userid, so a given user
 * keeps the same color across renders and across browser refreshes.
 */
const AVATAR_PALETTE = [
  '#0F2E6E', // ink900
  '#A34200', // down
  '#0F5C4C', // up
  '#663399', // tier traditional
  '#39414E', // neutral700
  '#1B4DAB', // primary
] as const

/**
 * Returns the avatar background color for a user. The hash is intentionally
 * not cryptographic; it's just a small mixing function that produces a
 * stable index into the palette.
 * @param {string} userid - The user's id.
 * @returns {string} A hex color from {@link AVATAR_PALETTE}.
 */
export function avatarColor(userid: string): string {
  let h = 0
  for (let i = 0; i < userid.length; i += 1)
    h = (h * 31 + userid.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

/** Short descriptor shown under the role name (matches the redesign mock). */
export const ROLE_DESCRIPTOR: Record<string, string> = {
  OWNER: 'Unscoped - write',
  HHS_ADMIN: 'Unscoped - write',
  HHS_READONLY_ADMIN: 'Unscoped - read',
  OPDIV_ADMIN: 'OpDiv-scoped - write',
  OPDIV_READONLY_ADMIN: 'OpDiv-scoped - read',
  ISSO: 'System-scoped',
  ISSM: 'System-scoped',
  ADMIN: 'Unscoped - write',
  READONLY_ADMIN: 'Unscoped - read',
}

/**
 * Maps a user record to a status pill label + kind. Deleted users render
 * as a neutral "Deactivated" chip; users without an identity_provider yet
 * are "Invited" (warning); everyone else is "Active".
 * @param {object} row - The user row (only the fields we need).
 * @returns {{ label: string, kind: 'active' | 'warning' | 'neutral' }}
 *   The status pill props.
 */
export function userStatus(row: {
  deleted?: boolean
  identity_provider?: string
}): {
  label: string
  kind: 'active' | 'warning' | 'neutral'
} {
  if (row.deleted) return { label: 'Deactivated', kind: 'neutral' }
  if (!row.identity_provider) return { label: 'Invited', kind: 'warning' }
  return { label: 'Active', kind: 'active' }
}

/**
 * Display label for the identity_provider column. Folds the raw lowercase
 * values from the backend ("okta", "entra") to the cased product names
 * used in the UI.
 * @param {string | undefined} idp - The raw identity_provider value.
 * @returns {string} The display name, or "-" when absent.
 */
export function idpLabel(idp: string | undefined): string {
  if (idp === 'okta') return 'Okta'
  if (idp === 'entra') return 'Entra'
  return '-'
}

/**
 * Email format validator used by the inline edit row's email input. The
 * regex is intentionally permissive (matches the prior validator used by
 * the Add User flow); we accept a broad superset and rely on the backend
 * for canonical validation.
 * @param {string} email - The candidate email.
 * @returns {boolean} True when the string passes the format check.
 */
export function validateEmail(email: string): boolean {
  return /^[a-zA-Z0-9._:$!%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/.test(email)
}
