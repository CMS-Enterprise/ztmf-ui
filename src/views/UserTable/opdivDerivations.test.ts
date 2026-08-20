// UserTable has no render coverage, so the OpDiv views it derives from the
// shared context list (#558) are pinned here instead. The caller-scope
// narrowing is the one that matters: it is a rule, not a transform.
import {
  buildOpDivCodeMap,
  buildOpDivLabelMap,
  buildAssignableOpDivs,
  narrowToCallerScope,
} from './opdivDerivations'
import type { OpDiv, userData, UserRole } from '@/types'

const opdiv = (over: Partial<OpDiv> & { opdiv_id: number }): OpDiv => ({
  code: `OD${over.opdiv_id}`,
  name: `OpDiv ${over.opdiv_id}`,
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
  ...over,
})

const HHS = opdiv({ opdiv_id: 1, code: 'HHS', is_parent: true })
const CMS = opdiv({ opdiv_id: 2, code: 'CMS' })
const ACF = opdiv({ opdiv_id: 3, code: 'ACF' })
const RETIRED = opdiv({ opdiv_id: 4, code: 'RETIRED', active: false })
const ALL = [HHS, CMS, ACF, RETIRED]

const user = (role: UserRole, assignedopdivids?: number[]): userData =>
  ({
    userid: 'u-1',
    email: 'a@b.gov',
    fullname: 'Tester',
    role,
    assignedopdivids,
  }) as userData

describe('buildOpDivCodeMap', () => {
  it('maps every id to its code, including the parent and inactive rows', () => {
    // The column falls back to a bare id for anything missing here, so a
    // grant to a since-deactivated OpDiv still has to resolve.
    expect(buildOpDivCodeMap(ALL)).toEqual({
      1: 'HHS',
      2: 'CMS',
      3: 'ACF',
      4: 'RETIRED',
    })
  })

  it('returns an empty map for no rows', () => {
    expect(buildOpDivCodeMap([])).toEqual({})
  })
})

describe('buildOpDivLabelMap', () => {
  it('carries code and name for every row', () => {
    expect(buildOpDivLabelMap([CMS, RETIRED])).toEqual({
      2: { code: 'CMS', name: 'OpDiv 2' },
      4: { code: 'RETIRED', name: 'OpDiv 4' },
    })
  })
})

describe('buildAssignableOpDivs', () => {
  it('drops the parent row and inactive rows', () => {
    // HHS is not a grantable tenant; RETIRED cannot take new grants.
    expect(buildAssignableOpDivs(ALL, true)).toEqual([CMS, ACF])
  })

  it('is empty for a non-write admin, who has no grant affordance', () => {
    expect(buildAssignableOpDivs(ALL, false)).toEqual([])
  })
})

describe('narrowToCallerScope', () => {
  const assignable = [CMS, ACF]

  it('narrows an OPDIV_ADMIN to the OpDivs they hold', () => {
    expect(narrowToCallerScope(assignable, user('OPDIV_ADMIN', [3]))).toEqual([
      ACF,
    ])
  })

  it('gives an OPDIV_ADMIN with no grants nothing to assign', () => {
    expect(narrowToCallerScope(assignable, user('OPDIV_ADMIN', []))).toEqual([])
    expect(
      narrowToCallerScope(assignable, user('OPDIV_ADMIN', undefined))
    ).toEqual([])
  })

  it('leaves unscoped tiers the full assignable set', () => {
    expect(narrowToCallerScope(assignable, user('OWNER'))).toEqual(assignable)
    expect(narrowToCallerScope(assignable, user('HHS_ADMIN'))).toEqual(
      assignable
    )
  })

  it('cannot widen past what was assignable, even for a held parent OpDiv', () => {
    // A grant on HHS must not resurrect the parent row as an option.
    expect(
      narrowToCallerScope(assignable, user('OPDIV_ADMIN', [1, 3]))
    ).toEqual([ACF])
  })
})

describe('the read-only admin labelling path', () => {
  it('labels OpDivs for a read-only admin even though they get no options', () => {
    // Pinning a deliberate change from #558: the fetch used to be gated on
    // write-tier admin, so read-only admins saw bare ids in the OpDivs column.
    const readOnly = user('HHS_READONLY_ADMIN')
    expect(buildOpDivCodeMap(ALL)[2]).toBe('CMS')
    expect(
      narrowToCallerScope(buildAssignableOpDivs(ALL, false), readOnly)
    ).toEqual([])
  })
})
