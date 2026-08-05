import { isUserCellEditable } from './cellEditGuards'

const ctx = { assignableRoles: ['ISSO', 'ISSM'], showIdpSelector: true }

describe('isUserCellEditable', () => {
  describe('opdivs', () => {
    // This is the gate that makes the discard unreachable. processRowUpdate
    // writes grants only on the create path, so an editable cell on an existing
    // row would commit, report success, and drop the change. If this assertion
    // ever fails, that bug is live again and the UI will claim it saved.
    it('is not editable on an existing user', () => {
      expect(isUserCellEditable('opdivs', { isNew: false }, ctx)).toBe(false)
    })

    it('is not editable when isNew is absent rather than false', () => {
      expect(isUserCellEditable('opdivs', {}, ctx)).toBe(false)
    })

    it('is editable on a new row, which is the path that persists grants', () => {
      expect(isUserCellEditable('opdivs', { isNew: true }, ctx)).toBe(true)
    })
  })

  describe('identity_provider', () => {
    it('is not editable on an existing user', () => {
      expect(
        isUserCellEditable('identity_provider', { isNew: false }, ctx)
      ).toBe(false)
    })

    it('is editable on a new row when the IdP column applies', () => {
      expect(
        isUserCellEditable('identity_provider', { isNew: true }, ctx)
      ).toBe(true)
    })

    it('stays locked on a new row when the IdP column does not apply', () => {
      expect(
        isUserCellEditable(
          'identity_provider',
          { isNew: true },
          {
            ...ctx,
            showIdpSelector: false,
          }
        )
      ).toBe(false)
    })
  })

  describe('role', () => {
    it('is editable when the current role is inside the assignable tier', () => {
      expect(
        isUserCellEditable('role', { isNew: false, role: 'ISSO' }, ctx)
      ).toBe(true)
    })

    it('is locked when the current role is outside the assignable tier', () => {
      // An admin who cannot grant OWNER must not be able to edit an OWNER's
      // role, since the edit control would otherwise offer a downgrade.
      expect(
        isUserCellEditable('role', { isNew: false, role: 'OWNER' }, ctx)
      ).toBe(false)
    })

    it('is editable on a row with no role yet', () => {
      expect(
        isUserCellEditable('role', { isNew: false, role: null }, ctx)
      ).toBe(true)
    })

    it('is editable on a new row regardless of assignable tier', () => {
      expect(
        isUserCellEditable('role', { isNew: true, role: 'OWNER' }, ctx)
      ).toBe(true)
    })
  })

  it('leaves other fields to the column definition', () => {
    expect(isUserCellEditable('email', { isNew: false }, ctx)).toBe(true)
    expect(isUserCellEditable('fullname', { isNew: false }, ctx)).toBe(true)
  })
})
