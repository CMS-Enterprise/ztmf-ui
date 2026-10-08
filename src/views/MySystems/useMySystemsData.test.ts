// Which score queries the band lets through: the history only once expanded,
// and the pillar aggregates never, since the band renders no pillar figures.

jest.mock('@/views/Title/Context', () => ({
  useContextProp: () => ({
    fismaSystems: [],
    fismaSystemsLoaded: true,
    datacalls: [
      {
        datacallid: 2,
        datacall: 'FY26 ZTM',
        datecreated: '2025-10-01',
        deadline: '2099-12-31',
      },
      {
        datacallid: 1,
        datacall: 'FY25 ZTM',
        datecreated: '2024-10-01',
        deadline: '2025-06-30',
      },
    ],
    activeDatacallIds: [2],
    selectedDatacall: null,
    latestDataCallId: 2,
    opdivs: [],
  }),
}))

const mockPillarAggregates = jest.fn()
const mockScoreHistory = jest.fn()
jest.mock('@/utils/scores', () => ({
  __esModule: true,
  useDatacallAggregates: () => ({
    scoresPerCall: [],
    isPending: false,
    isError: false,
  }),
  useDatacallProgress: () => ({
    progressPerCall: [],
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

/** The `enabled` flag every call to a query hook was made with. */
const enabledFlags = (mock: jest.Mock) =>
  mock.mock.calls.map((args) => (args.at(-1) as { enabled?: boolean }).enabled)

beforeEach(() => {
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
