import { filterPillarsForSystem } from './filterPillarsForSystem'

const FULL_PILLARS = [
  'Identity',
  'Devices',
  'Networks',
  'Applications',
  'Data',
  'CrossCutting',
]

describe('filterPillarsForSystem', () => {
  it('passes through when datacenterenvironment is null', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, null)).toEqual(FULL_PILLARS)
  })

  it('passes through when datacenterenvironment is undefined', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, undefined)).toEqual(
      FULL_PILLARS
    )
  })

  it('passes through when datacenterenvironment is not SaaS', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, 'On-Prem')).toEqual(
      FULL_PILLARS
    )
    expect(filterPillarsForSystem(FULL_PILLARS, 'Imperial-Fleet')).toEqual(
      FULL_PILLARS
    )
    expect(filterPillarsForSystem(FULL_PILLARS, '')).toEqual(FULL_PILLARS)
  })

  it('drops Devices and Applications when datacenterenvironment === SaaS', () => {
    expect(filterPillarsForSystem(FULL_PILLARS, 'SaaS')).toEqual([
      'Identity',
      'Networks',
      'Data',
      'CrossCutting',
    ])
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
