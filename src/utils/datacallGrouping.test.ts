import { groupDatacallsByYear } from './datacallGrouping'

type Row = {
  datacallid: number
  datacall: string
  deadline: string
  fiscal_year: number
}

describe('groupDatacallsByYear', () => {
  const calls: Row[] = [
    {
      datacallid: 1,
      datacall: 'FY23 ZTM',
      deadline: '2023-09-30',
      fiscal_year: 2023,
    },
    {
      datacallid: 2,
      datacall: 'FY2025 Q3',
      deadline: '2025-05-07',
      fiscal_year: 2025,
    },
    {
      datacallid: 3,
      datacall: 'FY25 ZTM',
      deadline: '2025-09-30',
      fiscal_year: 2025,
    },
    {
      datacallid: 4,
      datacall: 'FY24 ZTM',
      deadline: '2024-09-30',
      fiscal_year: 2024,
    },
    {
      datacallid: 5,
      datacall: 'FY2023 Q4',
      deadline: '2024-08-31',
      fiscal_year: 2023,
    },
  ]

  it('groups by the stored fiscal year, newest first', () => {
    const groups = groupDatacallsByYear(calls)
    expect(groups.map((g) => g.year)).toEqual([2025, 2024, 2023])
  })

  it('pairs quarterly and annual calls under the same year, deadline order', () => {
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

  it('places a free-text title under its stored year, whatever it says', () => {
    const titled: Row[] = [
      ...calls,
      // The title names no year at all.
      {
        datacallid: 7,
        datacall: 'Zero Trust data call',
        deadline: '2026-09-11',
        fiscal_year: 2026,
      },
      // The title names a year that is not the stored one. The field wins.
      {
        datacallid: 8,
        datacall: 'FY99 Q1 rerun',
        deadline: '2024-01-15',
        fiscal_year: 2024,
      },
    ]
    const groups = groupDatacallsByYear(titled)
    expect(groups.map((g) => g.year)).toEqual([2026, 2025, 2024, 2023])
    expect(groups[0].calls.map((c) => c.datacall)).toEqual([
      'Zero Trust data call',
    ])
    expect(
      groups.find((g) => g.year === 2024)?.calls.map((c) => c.datacallid)
    ).toEqual([4, 8])
  })

  it('returns an empty array for no calls', () => {
    expect(groupDatacallsByYear([])).toEqual([])
  })
})
