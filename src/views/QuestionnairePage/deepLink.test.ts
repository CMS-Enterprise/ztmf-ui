import {
  toSlug,
  encodeDatacallSlug,
  findSystemsByAcronym,
  resolveDatacallBySlug,
  resolveFunctionTarget,
  parseSystemIdParam,
  questionnairePath,
} from './deepLink'
import { FismaSystemType, datacall } from '@/types'

const sys = (fismasystemid: number, fismaacronym: string) =>
  ({ fismasystemid, fismaacronym }) as FismaSystemType

const dc = (datacallid: number, name: string): datacall =>
  ({
    datacallid,
    datacall: name,
    datecreated: '',
    deadline: '',
  }) as datacall

const cat = (name: string, steps: [number, string][]) => ({
  name,
  steps: steps.map(([functionid, fn]) => ({
    function: { functionid, function: fn },
  })),
})

describe('toSlug', () => {
  it('lowercases and hyphenates camelCase and spaces', () => {
    expect(toSlug('CrossCutting')).toBe('cross-cutting')
    expect(toSlug('Data Center')).toBe('data-center')
  })
})

describe('parseSystemIdParam', () => {
  it('reads a purely numeric segment as a fismasystemid', () => {
    expect(parseSystemIdParam('1002')).toBe(1002)
  })

  it('treats anything else as a legacy acronym segment', () => {
    // Acronyms may be all-caps, hyphenated, or even numeric-looking with a
    // suffix; none of these are ids.
    expect(parseSystemIdParam('ssd-ex')).toBeUndefined()
    expect(parseSystemIdParam('1002a')).toBeUndefined()
    expect(parseSystemIdParam('-1')).toBeUndefined()
    expect(parseSystemIdParam('')).toBeUndefined()
    expect(parseSystemIdParam(undefined)).toBeUndefined()
  })
})

describe('questionnairePath', () => {
  it('builds the bare id form', () => {
    expect(questionnairePath(1002)).toBe('/questionnaire/1002')
  })

  it('appends datacall / pillar / function segments, skipping absent ones', () => {
    expect(
      questionnairePath(1002, 'FY2026_Q1', 'identity', 'imperial-id')
    ).toBe('/questionnaire/1002/FY2026_Q1/identity/imperial-id')
    expect(questionnairePath(1002, 'FY2026_Q1')).toBe(
      '/questionnaire/1002/FY2026_Q1'
    )
    expect(questionnairePath(1002, undefined, undefined, undefined)).toBe(
      '/questionnaire/1002'
    )
  })

  it('does not depend on the acronym, so a slash in it cannot split the path', () => {
    // misc#382: "/questionnaire/alliance/fleet" used to parse as acronym
    // "alliance" + datacall "fleet". The id form has no such segment.
    const slashed = sys(7, 'ALLIANCE/FLEET')
    expect(questionnairePath(slashed.fismasystemid, 'FY2026_Q1')).toBe(
      '/questionnaire/7/FY2026_Q1'
    )
    expect(questionnairePath(slashed.fismasystemid).split('/')).toHaveLength(3)
  })
})

// Legacy-link resolution (pre-#732 acronym bookmarks redirect to the id form).
describe('findSystemsByAcronym', () => {
  const systems = [sys(1, 'ACO-MS'), sys(3, 'Pending'), sys(4, 'PENDING')]

  it('returns every case-insensitive match', () => {
    expect(
      findSystemsByAcronym(systems, 'pending').map((s) => s.fismasystemid)
    ).toEqual([3, 4])
    expect(findSystemsByAcronym(systems, 'ACO-MS')).toHaveLength(1)
  })

  it('returns an empty list for an unknown or missing acronym', () => {
    expect(findSystemsByAcronym(systems, 'nope')).toEqual([])
    expect(findSystemsByAcronym(systems, undefined)).toEqual([])
    expect(findSystemsByAcronym([], 'pending')).toEqual([])
  })
})

describe('encodeDatacallSlug', () => {
  it('encodes spaces as underscores (existing URL convention)', () => {
    expect(encodeDatacallSlug('FY2026 Q1')).toBe('FY2026_Q1')
  })

  it('doubles literal underscores so space/underscore mixes stay distinct', () => {
    expect(encodeDatacallSlug('FY_2025 Q4')).toBe('FY__2025_Q4')
    expect(encodeDatacallSlug('FY 2025_Q4')).toBe('FY_2025__Q4')
    expect(encodeDatacallSlug('FY_2025 Q4')).not.toBe(
      encodeDatacallSlug('FY 2025_Q4')
    )
  })
})

describe('resolveDatacallBySlug', () => {
  const datacalls = [dc(10, 'FY2026 Q1'), dc(11, 'FY2025 Q4')]

  it('matches the URL segment (spaces as underscores) to the datacall', () => {
    expect(resolveDatacallBySlug(datacalls, 'FY2026_Q1')?.datacallid).toBe(10)
    expect(resolveDatacallBySlug(datacalls, 'FY2025_Q4')?.datacallid).toBe(11)
  })

  it('matches case-insensitively, like the other resolvers', () => {
    expect(resolveDatacallBySlug(datacalls, 'fy2026_q1')?.datacallid).toBe(10)
    expect(resolveDatacallBySlug(datacalls, 'Fy2025_q4')?.datacallid).toBe(11)
  })

  it('distinguishes names that differ only by space vs literal underscore', () => {
    const tricky = [dc(20, 'FY_2025 Q4'), dc(21, 'FY 2025_Q4')]
    expect(resolveDatacallBySlug(tricky, 'FY__2025_Q4')?.datacallid).toBe(20)
    expect(resolveDatacallBySlug(tricky, 'FY_2025__Q4')?.datacallid).toBe(21)
  })

  it('returns undefined for an unrecognized or missing segment', () => {
    expect(resolveDatacallBySlug(datacalls, 'FY1999_Q9')).toBeUndefined()
    expect(resolveDatacallBySlug(datacalls, undefined)).toBeUndefined()
    expect(resolveDatacallBySlug([], 'FY2026_Q1')).toBeUndefined()
  })
})

describe('resolveFunctionTarget', () => {
  const categories = [
    cat('Identity', [
      [100, 'Authentication'],
      [101, 'Identity Stores'],
    ]),
    cat('CrossCutting', [[200, 'Visibility Analytics']]),
  ]

  it('resolves a pillar/function slug pair to the concrete function', () => {
    expect(
      resolveFunctionTarget(categories, 'identity', 'identity-stores')
    ).toEqual({
      functionid: 101,
      pillarName: 'Identity',
      functionName: 'Identity Stores',
    })
  })

  it('resolves camelCase pillar names via their slug', () => {
    expect(
      resolveFunctionTarget(categories, 'cross-cutting', 'visibility-analytics')
    ).toMatchObject({ functionid: 200 })
  })

  it('returns undefined when the function is not in the named pillar', () => {
    expect(
      resolveFunctionTarget(categories, 'identity', 'visibility-analytics')
    ).toBeUndefined()
  })

  it('returns undefined when either param is missing (fall back to first)', () => {
    expect(
      resolveFunctionTarget(categories, undefined, 'authentication')
    ).toBeUndefined()
    expect(
      resolveFunctionTarget(categories, 'identity', undefined)
    ).toBeUndefined()
  })
})
