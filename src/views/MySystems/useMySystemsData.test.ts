// Which score queries the band lets through: the history only once expanded,
// and the pillar aggregates never, since the band renders no pillar figures.

const ANNUAL_CALLS = [
  {
    datacallid: 2,
    datacall: 'FY26 ZTM',
    datecreated: '2025-10-01',
    deadline: '2099-12-31',
    fiscal_year: 2026,
    cadence: 'annual',
  },
  {
    datacallid: 1,
    datacall: 'FY25 ZTM',
    datecreated: '2024-10-01',
    deadline: '2025-06-30',
    fiscal_year: 2025,
    cadence: 'annual',
  },
]
const QUARTERLY_CALL = {
  datacallid: 3,
  datacall: 'Q1 check-in',
  datecreated: '2025-10-01',
  deadline: '2025-12-31',
  fiscal_year: 2026,
  cadence: 'quarterly',
}

// Mutable so a test can seed systems; the factory reads it at call time.
let mockSystems: unknown[] = []
let mockDatacalls: unknown[] = ANNUAL_CALLS
jest.mock('@/views/Title/Context', () => ({
  useContextProp: () => ({
    fismaSystems: mockSystems,
    fismaSystemsLoaded: true,
    datacallsLoaded: true,
    datacalls: mockDatacalls,
    activeDatacallIds: [2, 1],
    selectedDatacall: null,
    latestDataCallId: 2,
    opdivs: [],
  }),
}))

let mockProgressPerCall: unknown[][] = [[], []]
// Rows and pending state for a single-call request, which is how the cadence
// probe asks for the newest quarterly call.
let mockAggregatesByCall: Record<number, unknown[]> = {}
let mockPendingCall: number | null = null
const mockPillarAggregates = jest.fn()
const mockScoreHistory = jest.fn()
jest.mock('@/utils/scores', () => ({
  __esModule: true,
  useDatacallAggregates: (ids: number[]) => {
    const single = ids.length === 1 ? ids[0] : null
    return {
      scoresPerCall:
        single !== null && mockAggregatesByCall[single]
          ? [mockAggregatesByCall[single]]
          : [],
      isPending: single !== null && single === mockPendingCall,
      isError: false,
    }
  },
  useDatacallProgress: () => ({
    progressPerCall: mockProgressPerCall,
    isPending: false,
    isError: false,
  }),
  usePillarAggregates: (...args: unknown[]) => {
    mockPillarAggregates(...args)
    return { data: [], isPending: false }
  },
  useScoreHistory: (...args: unknown[]) => {
    mockScoreHistory(...args)
    return { data: [], isPending: false, isError: false }
  },
}))

import { renderHook } from '@testing-library/react'
import { useMySystemsData } from './useMySystemsData'
import { useOpDivDashboardData } from '@/views/OpDivDashboard/useOpDivDashboardData'
import { makeProgress, makeSystem } from '@/views/OpDivDashboard/testFixtures'

/** The `enabled` flag every call to a query hook was made with. */
const enabledFlags = (mock: jest.Mock) =>
  mock.mock.calls.map((args) => (args.at(-1) as { enabled?: boolean }).enabled)

beforeEach(() => {
  mockSystems = []
  mockDatacalls = ANNUAL_CALLS
  mockAggregatesByCall = {}
  mockPendingCall = null
  mockProgressPerCall = [[], []]
  mockPillarAggregates.mockClear()
  mockScoreHistory.mockClear()
})

test('collapsed, the band fetches neither history nor pillars', () => {
  renderHook(() => useMySystemsData(false))

  expect(enabledFlags(mockScoreHistory)).toEqual([false])
  // Anchor and prior call, both held off.
  expect(enabledFlags(mockPillarAggregates)).toEqual([false, false])
})

test('expanded, the band fetches the history but still no pillars', () => {
  renderHook(() => useMySystemsData(true))

  expect(enabledFlags(mockScoreHistory)).toEqual([true])
  expect(enabledFlags(mockPillarAggregates)).toEqual([false, false])
})

test('the OpDiv dashboard still fetches both by default', () => {
  renderHook(() => useOpDivDashboardData(null))

  expect(enabledFlags(mockScoreHistory)).toEqual([true])
  expect(enabledFlags(mockPillarAggregates)).toEqual([true, true])
})

test('completion counts only what the table filter can show', () => {
  // A system whose only progress is on the closed call, untouched there. The
  // table's "Not updated only" filter never shows a closed-call row.
  mockSystems = [makeSystem({ fismasystemid: 5 })]
  mockProgressPerCall = [
    [],
    [makeProgress(5, { questionsexpected: 40, questionsanswered: 0 })],
  ]

  const band = renderHook(() => useMySystemsData(false)).result.current
  const opdiv = renderHook(() => useOpDivDashboardData(null)).result.current

  expect(band.completion).toMatchObject({ systemsInCall: 0, notStarted: 0 })
  expect(opdiv.completion).toMatchObject({ systemsInCall: 1, notStarted: 1 })
})

describe('trend cadence', () => {
  const scored = (fismasystemid: number) => ({
    datacallid: QUARTERLY_CALL.datacallid,
    fismasystemid,
    systemscore: 3,
  })

  beforeEach(() => {
    mockDatacalls = [...ANNUAL_CALLS, QUARTERLY_CALL]
  })

  test('follows the quarterly series when the caller has one OpDiv and it took part in the newest quarterly call', () => {
    mockSystems = [
      makeSystem({ fismasystemid: 5, opdiv_id: 3 }),
      makeSystem({ fismasystemid: 6, opdiv_id: 3 }),
    ]
    mockAggregatesByCall = { 3: [scored(5)] }

    const band = renderHook(() => useMySystemsData(false)).result.current

    expect(band.trend.cadenceNote).toBe(
      'Quarterly calls, plus the newest annual call'
    )
  })

  test('follows the annual series when that OpDiv sat out the quarterly call', () => {
    mockSystems = [makeSystem({ fismasystemid: 5, opdiv_id: 3 })]
    mockAggregatesByCall = { 3: [scored(99)] }

    const band = renderHook(() => useMySystemsData(false)).result.current

    expect(band.trend.cadenceNote).toBe('Annual calls')
  })

  test('falls back to the annual series when the systems span OpDivs', () => {
    mockSystems = [
      makeSystem({ fismasystemid: 5, opdiv_id: 3 }),
      makeSystem({ fismasystemid: 6, opdiv_id: 4 }),
    ]
    mockAggregatesByCall = { 3: [scored(5), scored(6)] }

    const band = renderHook(() => useMySystemsData(false)).result.current

    expect(band.trend.cadenceNote).toBe('Annual calls')
  })

  test('holds the prior call until the cadence is known', () => {
    mockSystems = [makeSystem({ fismasystemid: 5, opdiv_id: 3 })]
    mockAggregatesByCall = { 3: [scored(5)] }
    mockPendingCall = 3

    const pending = renderHook(() => useMySystemsData(false)).result.current
    expect(pending.isPending).toBe(true)
    expect(pending.trend.isPending).toBe(true)
    expect(pending.priorCall).toBeNull()

    mockPendingCall = null
    const settled = renderHook(() => useMySystemsData(false)).result.current
    expect(settled.isPending).toBe(false)
    // FY26 ZTM is the anchor; the quarterly call precedes it in this series.
    expect(settled.priorCall?.datacallid).toBe(3)
  })
})
