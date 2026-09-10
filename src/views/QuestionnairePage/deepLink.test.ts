import {
  toSlug,
  encodeDatacallSlug,
  questionnairePath,
  findSystemsByAcronym,
  resolveSystemIdByAcronym,
  resolveDatacallBySlug,
  resolveFunctionTarget,
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

describe('resolveSystemIdByAcronym', () => {
  const systems = [sys(1, 'ACO-MS'), sys(2, 'ACUMEN-GSS')]

  it('resolves case-insensitively', () => {
    expect(resolveSystemIdByAcronym(systems, 'aco-ms')).toBe(1)
    expect(resolveSystemIdByAcronym(systems, 'ACUMEN-GSS')).toBe(2)
  })

  it('returns undefined for an unknown acronym', () => {
    expect(resolveSystemIdByAcronym(systems, 'nope')).toBeUndefined()
  })

  it('returns undefined when the acronym is missing', () => {
    expect(resolveSystemIdByAcronym(systems, undefined)).toBeUndefined()
  })

  it('returns undefined when systems have not loaded yet', () => {
    expect(resolveSystemIdByAcronym([], 'aco-ms')).toBeUndefined()
  })

  it('resolves an acronym containing a slash, as useParams hands it back decoded', () => {
    expect(resolveSystemIdByAcronym([sys(3, 'TIE/LN')], 'tie/ln')).toBe(3)
  })
})

describe('questionnairePath', () => {
  it('builds the bare acronym path', () => {
    expect(questionnairePath('SSD-EX')).toBe('/questionnaire/ssd-ex')
  })

  it('appends the datacall, pillar and function segments', () => {
    expect(
      questionnairePath('SSD-EX', {
        datacall: 'FY2026_Q1',
        pillar: 'identity',
        function: 'auth',
      })
    ).toBe('/questionnaire/ssd-ex/FY2026_Q1/identity/auth')
  })

  it('percent-encodes a slash in the acronym instead of splitting the path', () => {
    // Unencoded, "tie/ln" makes :fismaacronym capture "tie" and shifts every
    // later segment one place left.
    expect(questionnairePath('TIE/LN')).toBe('/questionnaire/tie%2Fln')
    expect(
      questionnairePath('TIE/LN', {
        datacall: 'FY2026_Q1',
        pillar: 'identity',
        function: 'auth',
      })
    ).toBe('/questionnaire/tie%2Fln/FY2026_Q1/identity/auth')
  })

  it('encodes the datacall segment too, so a slash in a call name cannot split it', () => {
    expect(
      questionnairePath('ssd-ex', {
        datacall: encodeDatacallSlug('FY26 A/B'),
        pillar: 'identity',
        function: 'auth',
      })
    ).toBe('/questionnaire/ssd-ex/FY26_A%2FB/identity/auth')
  })

  it('emits an empty segment rather than "undefined" for a missing acronym', () => {
    // Unreachable in practice: fismaacronym is required on FismaSystemType and
    // a matched route always supplies the param. This pins the non-crashing
    // shape, not a supported URL — /questionnaire/ matches no route.
    expect(questionnairePath(undefined)).toBe('/questionnaire/')
  })
  
  it('refuses to guess when more than one system shares the acronym', () => {
    // Acronyms are not unique; picking the first match opened another
    // system's questionnaire.
    const dupes = [...systems, sys(3, 'Pending'), sys(4, 'PENDING')]
    expect(resolveSystemIdByAcronym(dupes, 'pending')).toBeUndefined()
    expect(resolveSystemIdByAcronym(dupes, 'aco-ms')).toBe(1)
  })
})

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
