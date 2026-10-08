import {
  adminTierRoster,
  classifyDelegateExpiry,
  usersForOpDiv,
} from './opdivPeople'
import type { UserRole, users } from '@/types'

const makeUser = (overrides: Partial<users> & { role: UserRole }): users => ({
  userid: `u-${Math.random().toString(36).slice(2)}`,
  email: 'person@example.gov',
  fullname: 'A Person',
  assignedfismasystems: [],
  assignedopdivids: [7],
  ...overrides,
})

const NOW = new Date('2026-09-24T00:00:00Z')

describe('usersForOpDiv', () => {
  it('keeps grant holders and drops deleted accounts', () => {
    const all = [
      makeUser({ role: 'OPDIV_ADMIN', userid: 'a', assignedopdivids: [7] }),
      makeUser({ role: 'OPDIV_ADMIN', userid: 'b', assignedopdivids: [9] }),
      makeUser({
        role: 'OPDIV_ADMIN',
        userid: 'c',
        assignedopdivids: [7],
        deleted: true,
      }),
      makeUser({ role: 'OPDIV_ADMIN', userid: 'd', assignedopdivids: null }),
    ]
    expect(usersForOpDiv(all, 7).map((u) => u.userid)).toEqual(['a'])
  })
})

describe('adminTierRoster', () => {
  it('lists admin tiers only, most privileged first then by name', () => {
    const scoped = [
      makeUser({ role: 'OPDIV_ADMIN', fullname: 'Zed' }),
      makeUser({ role: 'OPDIV_ADMIN', fullname: 'Amy' }),
      makeUser({ role: 'HHS_ADMIN', fullname: 'Mo' }),
    ]
    expect(adminTierRoster(scoped).map((u) => u.fullname)).toEqual([
      'Mo',
      'Amy',
      'Zed',
    ])
  })

  it('excludes ISSO, ISSM and delegates, whose grant is not their scope', () => {
    // These roles can carry a legacy OpDiv grant the backend ignores when
    // deciding what they can see, so listing them would overstate coverage.
    const scoped = [
      makeUser({ role: 'ISSO' }),
      makeUser({ role: 'ISSM' }),
      makeUser({ role: 'SYSTEM_DELEGATE' }),
    ]
    expect(adminTierRoster(scoped)).toEqual([])
  })
})

describe('classifyDelegateExpiry', () => {
  it('splits delegates by how close their access is to lapsing', () => {
    const scoped = [
      makeUser({
        role: 'SYSTEM_DELEGATE',
        userid: 'expired',
        access_expires_at: '2026-09-01T00:00:00Z',
      }),
      makeUser({
        role: 'SYSTEM_DELEGATE',
        userid: 'soon',
        access_expires_at: '2026-10-10T00:00:00Z',
      }),
      makeUser({
        role: 'SYSTEM_DELEGATE',
        userid: 'later',
        access_expires_at: '2027-01-01T00:00:00Z',
      }),
    ]
    const result = classifyDelegateExpiry(scoped, NOW)
    expect(result.expired.map((u) => u.userid)).toEqual(['expired'])
    expect(result.expiringSoon.map((u) => u.userid)).toEqual(['soon'])
    expect(result.active.map((u) => u.userid)).toEqual(['later'])
  })

  it('treats a null expiry as non-lapsing, not as unknown', () => {
    const scoped = [
      makeUser({
        role: 'SYSTEM_DELEGATE',
        userid: 'forever',
        access_expires_at: null,
      }),
    ]
    expect(
      classifyDelegateExpiry(scoped, NOW).active.map((u) => u.userid)
    ).toEqual(['forever'])
  })

  it('ignores non-delegate roles entirely', () => {
    const scoped = [
      makeUser({ role: 'OPDIV_ADMIN' }),
      makeUser({ role: 'ISSO' }),
    ]
    const result = classifyDelegateExpiry(scoped, NOW)
    expect(result.active).toHaveLength(0)
    expect(result.expiringSoon).toHaveLength(0)
    expect(result.expired).toHaveLength(0)
  })
})
