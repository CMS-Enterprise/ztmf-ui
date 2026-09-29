import { scopeSystemsToOpDiv } from './opdivAggregates'
import {
  canAggregate,
  canViewOpDiv,
  parseOpDivParam,
  preferredOpDiv,
  visibleOpDivs,
} from './useOpDivScope'
import { makeSystem } from './testFixtures'
import type { OpDiv, UserRole, userData } from '@/types'

const makeOpDiv = (
  overrides: Partial<OpDiv> & { opdiv_id: number }
): OpDiv => ({
  code: `OD${overrides.opdiv_id}`,
  name: `OpDiv ${overrides.opdiv_id}`,
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
  ...overrides,
})

const makeUser = (
  role: UserRole,
  assignedopdivids?: number[] | null
): userData => ({
  userid: 'u1',
  email: 'a@example.gov',
  fullname: 'A User',
  role,
  assignedopdivids,
})

const CATALOG: OpDiv[] = [
  makeOpDiv({ opdiv_id: 1, code: 'HHS', is_parent: true }),
  makeOpDiv({ opdiv_id: 7, code: 'NIH' }),
  makeOpDiv({ opdiv_id: 9, code: 'CDC' }),
  makeOpDiv({ opdiv_id: 12, code: 'OLD', active: false }),
]

describe('visibleOpDivs', () => {
  it('gives unscoped tiers every active OpDiv, ordered by code', () => {
    // HHS is included even though it is the parent row: it is not a grantable
    // tenant, but it owns systems, so it has a dashboard worth opening. An
    // inactive OpDiv is not switchable - but see the resolution test below,
    // it stays readable by direct URL.
    expect(
      visibleOpDivs(makeUser('HHS_READONLY_ADMIN'), CATALOG).map((o) => o.code)
    ).toEqual(['CDC', 'HHS', 'NIH'])
  })

  it('still excludes inactive OpDivs from the switchable set', () => {
    expect(
      visibleOpDivs(makeUser('OWNER'), CATALOG).map((o) => o.code)
    ).not.toContain('OLD')
  })

  it('narrows OpDiv tiers to their own grants', () => {
    expect(
      visibleOpDivs(makeUser('OPDIV_ADMIN', [7]), CATALOG).map((o) => o.code)
    ).toEqual(['NIH'])
  })

  it('falls back to the server-scoped systems list when grants are missing', () => {
    // The systems list is already narrowed by the backend, so it is a safe
    // secondary source when the grants array is absent.
    const systems = [makeSystem({ fismasystemid: 1, opdiv_id: 9 })]
    expect(
      visibleOpDivs(makeUser('OPDIV_ADMIN', null), CATALOG, systems).map(
        (o) => o.code
      )
    ).toEqual(['CDC'])
  })

  it('treats an empty grants array as a real answer, not a missing one', () => {
    expect(
      visibleOpDivs(makeUser('OPDIV_ADMIN', []), CATALOG, [
        makeSystem({ fismasystemid: 1, opdiv_id: 9 }),
      ])
    ).toEqual([])
  })

  it('gives non-admin tiers nothing', () => {
    expect(visibleOpDivs(makeUser('ISSO', [7]), CATALOG)).toEqual([])
    expect(visibleOpDivs(makeUser('SYSTEM_DELEGATE', [7]), CATALOG)).toEqual([])
  })
})

describe('canViewOpDiv', () => {
  it('lets unscoped tiers open any OpDiv', () => {
    expect(canViewOpDiv(makeUser('OWNER'), 9)).toBe(true)
    expect(canViewOpDiv(makeUser('HHS_READONLY_ADMIN'), 9)).toBe(true)
  })

  it('holds OpDiv tiers to their grants', () => {
    expect(canViewOpDiv(makeUser('OPDIV_ADMIN', [7]), 7)).toBe(true)
    expect(canViewOpDiv(makeUser('OPDIV_ADMIN', [7]), 9)).toBe(false)
  })

  it('refuses system-scoped and delegate tiers outright', () => {
    // An ISSO can carry a legacy OpDiv grant the backend ignores, so a grant
    // alone must never open an OpDiv-wide view.
    expect(canViewOpDiv(makeUser('ISSO', [7]), 7)).toBe(false)
    expect(canViewOpDiv(makeUser('ISSM', [7]), 7)).toBe(false)
    expect(canViewOpDiv(makeUser('SYSTEM_DELEGATE', [7]), 7)).toBe(false)
  })
})

describe('canAggregate', () => {
  it('needs more than one OpDiv to be worth offering', () => {
    // With a single visible OpDiv the aggregate IS that OpDiv, so offering it
    // would be two routes to the same page.
    const visible = visibleOpDivs(makeUser('OWNER'), CATALOG)
    expect(canAggregate(visible)).toBe(true)
    expect(
      canAggregate(visibleOpDivs(makeUser('OPDIV_ADMIN', [7]), CATALOG))
    ).toBe(false)
    expect(canAggregate([])).toBe(false)
  })
})

describe('scopeSystemsToOpDiv in the aggregate', () => {
  it('applies no OpDiv filter at all, keeping the whole server-scoped set', () => {
    // Not "every visible OpDiv id": /fismasystems is already narrowed to the
    // caller, and filtering by the switchable set would drop systems owned by
    // the HHS parent row from a total that claims to cover everything.
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 9 }),
      makeSystem({ fismasystemid: 3, opdiv_id: 1 }),
      makeSystem({ fismasystemid: 4, opdiv_id: null }),
    ]
    expect(
      scopeSystemsToOpDiv(systems, null).map((s) => s.fismasystemid)
    ).toEqual([1, 2, 3, 4])
  })

  it('still excludes decommissioned systems', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 9, decommissioned: true }),
    ]
    expect(
      scopeSystemsToOpDiv(systems, null).map((s) => s.fismasystemid)
    ).toEqual([1])
  })
})

describe('parseOpDivParam', () => {
  it('rejects the aggregate sentinel, which is not an OpDiv', () => {
    // Handled by the caller before this point; rejected here too so it can
    // never resolve to an OpDiv whose id happens to parse.
    expect(parseOpDivParam('all', CATALOG)).toBeNull()
  })

  it('resolves a known id, including an inactive OpDiv', () => {
    // Resolution is deliberately wider than the switcher: a just-deactivated
    // OpDiv's numbers stay reachable by direct URL.
    expect(parseOpDivParam('12', CATALOG)?.code).toBe('OLD')
  })

  it('rejects the manage path defensively', () => {
    // Static routes outrank dynamic ones so this should be unreachable, but a
    // route reshuffle would otherwise render the grid path as an empty board.
    expect(parseOpDivParam('manage', CATALOG)).toBeNull()
  })

  it('rejects non-integer and unknown ids', () => {
    expect(parseOpDivParam('7abc', CATALOG)).toBeNull()
    expect(parseOpDivParam('', CATALOG)).toBeNull()
    expect(parseOpDivParam(undefined, CATALOG)).toBeNull()
    expect(parseOpDivParam('999', CATALOG)).toBeNull()
  })
})

describe('preferredOpDiv', () => {
  afterEach(() => window.sessionStorage.clear())

  it('returns the first by code when nothing is remembered', () => {
    const visible = visibleOpDivs(makeUser('OWNER'), CATALOG)
    expect(preferredOpDiv(visible)?.code).toBe('CDC')
  })

  it('prefers a remembered OpDiv that is still visible', () => {
    window.sessionStorage.setItem('ztmf.lastOpDivId', '7')
    const visible = visibleOpDivs(makeUser('OWNER'), CATALOG)
    expect(preferredOpDiv(visible)?.code).toBe('NIH')
  })

  it('ignores a remembered OpDiv the user can no longer see', () => {
    window.sessionStorage.setItem('ztmf.lastOpDivId', '9')
    const visible = visibleOpDivs(makeUser('OPDIV_ADMIN', [7]), CATALOG)
    expect(preferredOpDiv(visible)?.code).toBe('NIH')
  })

  it('returns null when there is nothing to land on', () => {
    expect(preferredOpDiv([])).toBeNull()
  })
})
