import { parseDatacallName, groupDatacallsByYear } from './datacallGrouping'

type Row = { datacallid: number; datacall: string; deadline: string }

describe('parseDatacallName', () => {
  it('parses a 4-digit CMS quarterly call', () => {
    expect(parseDatacallName('FY2025 Q3')).toEqual({
      fiscalYear: 2025,
      tenant: 'CMS',
    })
  })

  it('parses a 2-digit HHS ZTM call', () => {
    expect(parseDatacallName('FY25 ZTM')).toEqual({
      fiscalYear: 2025,
      tenant: 'HHS',
    })
  })

  it('expands a 2-digit fiscal year to 20##', () => {
    expect(parseDatacallName('FY23 Q1').fiscalYear).toBe(2023)
  })

  it('returns Other/null for an unrecognized name', () => {
    expect(parseDatacallName('Special one-off')).toEqual({
      fiscalYear: null,
      tenant: 'Other',
    })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseDatacallName('  FY24 ZTM  ').fiscalYear).toBe(2024)
  })
})

describe('groupDatacallsByYear', () => {
  const calls: Row[] = [
    { datacallid: 1, datacall: 'FY23 ZTM', deadline: '2023-09-30' },
    { datacallid: 2, datacall: 'FY2025 Q3', deadline: '2025-05-07' },
    { datacallid: 3, datacall: 'FY25 ZTM', deadline: '2025-09-30' },
    { datacallid: 4, datacall: 'FY24 ZTM', deadline: '2024-09-30' },
    { datacallid: 5, datacall: 'FY2023 Q4', deadline: '2024-08-31' },
  ]

  it('groups by fiscal year, newest first', () => {
    const groups = groupDatacallsByYear(calls)
    expect(groups.map((g) => g.year)).toEqual([2025, 2024, 2023])
  })

  it('pairs the CMS and HHS calls under the same year', () => {
    const y2025 = groupDatacallsByYear(calls).find((g) => g.year === 2025)
    expect(y2025?.calls.map((c) => c.datacall)).toEqual([
      'FY25 ZTM', // deadline 2025-09-30, furthest out first
      'FY2025 Q3', // deadline 2025-05-07
    ])
    const y2023 = groupDatacallsByYear(calls).find((g) => g.year === 2023)
    expect(y2023?.calls.map((c) => c.datacall).sort()).toEqual([
      'FY2023 Q4',
      'FY23 ZTM',
    ])
  })

  it('sinks an unparseable call to the bottom in its own null-year bucket', () => {
    const withOther: Row[] = [
      ...calls,
      { datacallid: 9, datacall: 'Legacy import', deadline: '2022-01-01' },
    ]
    const groups = groupDatacallsByYear(withOther)
    expect(groups[groups.length - 1].year).toBeNull()
    expect(groups[groups.length - 1].calls[0].datacall).toBe('Legacy import')
  })

  it('returns an empty array for no calls', () => {
    expect(groupDatacallsByYear([])).toEqual([])
  })
})
