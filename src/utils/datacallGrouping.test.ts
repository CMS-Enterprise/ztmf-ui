import { parseDatacallName, groupDatacallsByYear } from './datacallGrouping'

type Row = { datacallid: number; datacall: string; deadline: string }

describe('parseDatacallName', () => {
  it('parses a 4-digit quarterly call', () => {
    expect(parseDatacallName('FY2025 Q3')).toEqual({
      fiscalYear: 2025,
      cadence: 'quarterly',
    })
  })

  it('parses a 2-digit ZTM call as annual', () => {
    expect(parseDatacallName('FY25 ZTM')).toEqual({
      fiscalYear: 2025,
      cadence: 'annual',
    })
  })

  it('parses a 4-digit ZTM call and a 2-digit quarterly call', () => {
    expect(parseDatacallName('FY2026 ZTM')).toEqual({
      fiscalYear: 2026,
      cadence: 'annual',
    })
    expect(parseDatacallName('FY26 Q1')).toEqual({
      fiscalYear: 2026,
      cadence: 'quarterly',
    })
  })

  it('expands a 2-digit fiscal year to 20##', () => {
    expect(parseDatacallName('FY23 Q1').fiscalYear).toBe(2023)
  })

  it('reads the year from a descriptive FY-prefixed name as annual', () => {
    expect(parseDatacallName('FY2027 Zero Trust Data Call')).toEqual({
      fiscalYear: 2027,
      cadence: 'annual',
    })
    expect(parseDatacallName('FY27 Annual Assessment')).toEqual({
      fiscalYear: 2027,
      cadence: 'annual',
    })
    expect(parseDatacallName('FY2027')).toEqual({
      fiscalYear: 2027,
      cadence: 'annual',
    })
  })

  it('treats a quarter as the first word after the year as quarterly', () => {
    expect(parseDatacallName('FY2027 Q2 Zero Trust Data Call')).toEqual({
      fiscalYear: 2027,
      cadence: 'quarterly',
    })
    // A word that only starts with Q is not a quarter.
    expect(parseDatacallName('FY2027 Quarterly Review').cadence).toBe('annual')
    expect(parseDatacallName('FY2027 Q5').cadence).toBe('annual')
  })

  it('returns null year and cadence for a name with no FY prefix', () => {
    for (const name of [
      'Special one-off',
      'Audit Fields Smoke Cycle',
      '2027 Zero Trust Data Call',
      'Data Call FY2027',
    ]) {
      expect(parseDatacallName(name)).toEqual({
        fiscalYear: null,
        cadence: null,
      })
    }
  })

  it('rejects a year that is not 2 or 4 digits', () => {
    expect(parseDatacallName('FY202 ZTM').fiscalYear).toBeNull()
    expect(parseDatacallName('FY20255 Q1').fiscalYear).toBeNull()
    expect(parseDatacallName('FY5 ZTM').fiscalYear).toBeNull()
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseDatacallName('  FY24 ZTM  ').fiscalYear).toBe(2024)
    expect(parseDatacallName('  FY2024 Q4  ').cadence).toBe('quarterly')
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

  it('pairs the quarterly and annual calls under the same year', () => {
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

  it('groups a descriptive FY-prefixed name with the other calls of its year', () => {
    const withDescriptive: Row[] = [
      ...calls,
      {
        datacallid: 6,
        datacall: 'FY2025 Zero Trust Data Call',
        deadline: '2025-08-01',
      },
      {
        datacallid: 7,
        datacall: 'FY2027 Zero Trust Data Call',
        deadline: '2027-09-30',
      },
    ]
    const groups = groupDatacallsByYear(withDescriptive)
    expect(groups.map((g) => g.year)).toEqual([2027, 2025, 2024, 2023])
    expect(groups[0].calls.map((c) => c.datacall)).toEqual([
      'FY2027 Zero Trust Data Call',
    ])
    expect(groups[1].calls.map((c) => c.datacall)).toEqual([
      'FY25 ZTM',
      'FY2025 Zero Trust Data Call',
      'FY2025 Q3',
    ])
  })

  it('sinks a call with no FY prefix to the bottom in its own null-year bucket', () => {
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
