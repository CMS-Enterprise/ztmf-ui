import {
  toSlug,
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
})

describe('resolveDatacallBySlug', () => {
  const datacalls = [dc(10, 'FY2026 Q1'), dc(11, 'FY2025 Q4')]

  it('matches the URL segment (spaces as underscores) to the datacall', () => {
    expect(resolveDatacallBySlug(datacalls, 'FY2026_Q1')?.datacallid).toBe(10)
    expect(resolveDatacallBySlug(datacalls, 'FY2025_Q4')?.datacallid).toBe(11)
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
