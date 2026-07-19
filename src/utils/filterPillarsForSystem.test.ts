import { filterPillarsForSystem } from './filterPillarsForSystem'

// The second argument is the system's resolved scoring *category*, not its
// raw datacenterenvironment. Raw-to-category resolution is the caller's job
// (see toCategoryMap); this pure function only compares the category.

const FULL_PILLARS = [
  'Identity',
  'Devices',
  'Networks',
  'Applications',
  'Data',
  'CrossCutting',
]

const SAAS_FILTERED = ['Identity', 'Networks', 'Data', 'CrossCutting']

describe('filterPillarsForSystem', () => {
  it('passes through when category is null', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, null)).toEqual(FULL_PILLARS)
  })

  it('passes through when category is undefined', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, undefined)).toEqual(
      FULL_PILLARS
    )
  })

  it('passes through when category is not SaaS', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, 'data-center-gov')).toEqual(
      FULL_PILLARS
    )
    expect(filterPillarsForSystem(FULL_PILLARS, 'Imperial-Fleet')).toEqual(
      FULL_PILLARS
    )
    expect(filterPillarsForSystem(FULL_PILLARS, '')).toEqual(FULL_PILLARS)
  })

  it('drops Devices and Applications when category === SaaS', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, 'SaaS')).toEqual(SAAS_FILTERED)
  })

  it('filters on the resolved category even when it came from an alias raw value', () => {
    // A raw value like "Some SaaS Alias" resolves (via toCategoryMap) to the
    // 'SaaS' category before reaching here; passing that category filters.
    expect(filterPillarsForSystem(FULL_PILLARS, 'SaaS')).toEqual(SAAS_FILTERED)
  })

  it('is case-sensitive on the SaaS check (matches BE convention exactly)', () => {
    // BE returns 'SaaS' exactly; anything else is treated as a different
    // environment and not filtered. Guards against silent breakage if the
    // BE ever ships a typo or a casing change.
    expect(filterPillarsForSystem(FULL_PILLARS, 'saas')).toEqual(FULL_PILLARS)
    expect(filterPillarsForSystem(FULL_PILLARS, 'SAAS')).toEqual(FULL_PILLARS)
  })

  it('preserves input order of the surviving pillars', () => {
    const reordered = ['Data', 'Identity', 'Devices', 'CrossCutting']
    expect(filterPillarsForSystem(reordered, 'SaaS')).toEqual([
      'Data',
      'Identity',
      'CrossCutting',
    ])
  })

  it('returns an empty array when given an empty input', () => {
    expect(filterPillarsForSystem([], 'SaaS')).toEqual([])
    expect(filterPillarsForSystem([], null)).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [...FULL_PILLARS]
    filterPillarsForSystem(input, 'SaaS')
    expect(input).toEqual(FULL_PILLARS)
  })
})
