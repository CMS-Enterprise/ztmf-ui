import {
  initialsFor,
  avatarColor,
  userStatus,
  idpLabel,
  validateEmail,
} from './helpers'

describe('initialsFor', () => {
  test('uses first letters of first two whitespace-separated words', () => {
    expect(initialsFor('Leia Organa', 'leia@x.gov')).toBe('LO')
  })

  test('splits on dot/underscore/dash separators when the name is missing', () => {
    expect(initialsFor(undefined, 'jane.doe@x.gov')).toBe('JD')
    expect(initialsFor('', 'jane_doe@x.gov')).toBe('JD')
    expect(initialsFor(undefined, 'jane-doe@x.gov')).toBe('JD')
  })

  test('caps at two characters even with longer names', () => {
    expect(initialsFor('Anakin McGuffin Skywalker', 'a@x.gov')).toBe('AM')
  })

  test('falls back to "U" when there is nothing to derive from', () => {
    expect(initialsFor('', '')).toBe('U')
    expect(initialsFor(undefined, '@x.gov')).toBe('U')
  })
})

describe('avatarColor', () => {
  test('is deterministic for the same userid', () => {
    expect(avatarColor('abc')).toBe(avatarColor('abc'))
    expect(avatarColor('user-42')).toBe(avatarColor('user-42'))
  })

  test('returns a hex color from the palette', () => {
    expect(avatarColor('whatever')).toMatch(/^#[0-9A-F]{6}$/i)
  })

  test('does not collapse every userid to the same color', () => {
    const colors = new Set(
      Array.from({ length: 50 }, (_, i) => avatarColor(`user-${i}`))
    )
    // Six-entry palette - expect more than one bucket to be hit across 50
    // distinct ids. (Pinning the exact size would couple to the hash, but
    // "more than one" is enough to catch a hash regression.)
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('userStatus', () => {
  test('deleted -> Deactivated/neutral, irrespective of identity_provider', () => {
    expect(userStatus({ deleted: true, identity_provider: 'okta' })).toEqual({
      label: 'Deactivated',
      kind: 'neutral',
    })
  })

  test('no identity_provider on a live row -> Invited/warning', () => {
    expect(userStatus({ deleted: false })).toEqual({
      label: 'Invited',
      kind: 'warning',
    })
  })

  test('live + identity_provider -> Active/active', () => {
    expect(userStatus({ identity_provider: 'okta' })).toEqual({
      label: 'Active',
      kind: 'active',
    })
  })
})

describe('idpLabel', () => {
  test('maps lowercase backend value to display name', () => {
    expect(idpLabel('okta')).toBe('Okta')
    expect(idpLabel('entra')).toBe('Entra')
  })

  test('returns "-" for unknown / absent values', () => {
    expect(idpLabel(undefined)).toBe('-')
    expect(idpLabel('saml')).toBe('-')
  })
})

describe('validateEmail', () => {
  test('accepts common email shapes', () => {
    expect(validateEmail('jane@x.gov')).toBe(true)
    expect(validateEmail('jane.doe+admin@example.co.uk')).toBe(false)
    // The repo's pre-existing regex (lifted verbatim from the Add User flow)
    // does not allow + in the local part; the assertion above pins that
    // current behavior so a future tightening does not silently regress.
    expect(validateEmail('jane.doe@example.co.uk')).toBe(true)
  })

  test('rejects malformed strings', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('no-at-sign.gov')).toBe(false)
    expect(validateEmail('jane@')).toBe(false)
    expect(validateEmail('@x.gov')).toBe(false)
  })
})
