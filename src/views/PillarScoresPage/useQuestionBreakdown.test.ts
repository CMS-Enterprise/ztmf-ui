import { renderHook, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'

// Sidestep the production axiosConfig module - it reads import.meta.env at
// load time, which swc/jest leaves as a literal and node refuses to evaluate.
// The hook only consumes the axios instance shape, so a fresh one with no
// interceptors is sufficient: this test never exercises the 401 redirect.
// We also have to mock @/router/router (transitively pulled by
// authInterceptor) for the same reason - it imports LoginPage which uses
// import.meta.env.
jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { useQuestionBreakdown } from './useQuestionBreakdown'

const mock = new MockAdapter(axiosInstance)

const questions = [
  {
    questionid: 1,
    question: 'Do you do MFA?',
    pillar: { pillar: 'Identity' },
    function: { functionid: 100, function: 'MFA' },
  },
  {
    questionid: 2,
    question: 'Do you encrypt data at rest?',
    pillar: { pillar: 'Data' },
    function: { functionid: 200, function: 'Encryption' },
  },
  {
    questionid: 3,
    question: 'Do you patch devices?',
    pillar: { pillar: 'Devices' },
    function: { functionid: 300, function: 'Patching' },
  },
]

const scores = [
  // Data: rawScore 2 -> displayScore 3
  {
    scoreid: 11,
    functionoptionid: 22,
    functionoption: {
      functionoptionid: 22,
      functionid: 200,
      score: 2,
      optionname: '',
      description: '',
    },
  },
  // Identity: rawScore 3 -> displayScore 4
  {
    scoreid: 12,
    functionoptionid: 23,
    functionoption: {
      functionoptionid: 23,
      functionid: 100,
      score: 3,
      optionname: '',
      description: '',
    },
  },
  // Devices: rawScore 0 -> displayScore 1
  {
    scoreid: 13,
    functionoptionid: 24,
    functionoption: {
      functionoptionid: 24,
      functionid: 300,
      score: 0,
      optionname: '',
      description: '',
    },
  },
]

beforeEach(() => {
  mock.reset()
})

describe('useQuestionBreakdown', () => {
  test('joins questions x scores by functionid, applies +1 shift, sorts by PILLAR_ORDER', async () => {
    mock
      .onGet('/fismasystems/7/questions')
      .reply(200, { data: questions })
      .onGet('scores?datacallid=4&fismasystemid=7&include=functionoption')
      .reply(200, { data: scores })

    const { result } = renderHook(() => useQuestionBreakdown(7, 4))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows).toHaveLength(3)
    // PILLAR_ORDER is Identity, Devices, Networks, Applications, Data,
    // CrossCutting - so the join must order Identity -> Devices -> Data
    // even though scores arrived in Data, Identity, Devices order.
    expect(result.current.rows.map((r) => r.pillar)).toEqual([
      'Identity',
      'Devices',
      'Data',
    ])
    // +1 shift: raw 3 -> 4, raw 0 -> 1, raw 2 -> 3 (in pillar-sorted order)
    expect(result.current.rows.map((r) => r.displayScore)).toEqual([4, 1, 3])
    expect(result.current.pillarOptions).toEqual([
      'Identity',
      'Devices',
      'Data',
    ])
  })

  test('drops score rows whose functionid has no matching question (stale row guard)', async () => {
    mock.onGet('/fismasystems/7/questions').reply(200, { data: questions })
    mock
      .onGet('scores?datacallid=4&fismasystemid=7&include=functionoption')
      .reply(200, {
        data: [
          ...scores,
          {
            scoreid: 99,
            functionoptionid: 99,
            functionoption: {
              functionoptionid: 99,
              // No matching question for functionid 9999 - row must be dropped.
              functionid: 9999,
              score: 4,
              optionname: '',
              description: '',
            },
          },
        ],
      })

    const { result } = renderHook(() => useQuestionBreakdown(7, 4))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows).toHaveLength(3)
    expect(result.current.rows.find((r) => r.scoreid === 99)).toBeUndefined()
  })

  test('drops score rows missing the functionoption join (functionid null)', async () => {
    mock.onGet('/fismasystems/7/questions').reply(200, { data: questions })
    mock
      .onGet('scores?datacallid=4&fismasystemid=7&include=functionoption')
      .reply(200, {
        data: [
          { scoreid: 50, functionoptionid: 50 }, // no functionoption at all
        ],
      })

    const { result } = renderHook(() => useQuestionBreakdown(7, 4))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows).toEqual([])
    expect(result.current.pillarOptions).toEqual([])
  })

  test('returns empty rows and stays loading until both fetches resolve', async () => {
    mock.onGet('/fismasystems/7/questions').reply(200, { data: [] })
    mock
      .onGet('scores?datacallid=4&fismasystemid=7&include=functionoption')
      .reply(200, { data: [] })

    const { result } = renderHook(() => useQuestionBreakdown(7, 4))

    // Initial render before the effect resolves - loading is true.
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual([])
    expect(result.current.pillarOptions).toEqual([])
  })

  test('does not fetch when either id is falsy (guard at top of effect)', async () => {
    const { result, rerender } = renderHook(
      ({ s, d }: { s: number; d: number }) => useQuestionBreakdown(s, d),
      { initialProps: { s: 0, d: 0 } }
    )
    // No mock handlers registered means any request would 404 and surface
    // in the request history; we expect zero requests for the 0/0 guard.
    expect(mock.history.get).toHaveLength(0)
    expect(result.current.loading).toBe(true)
    expect(result.current.rows).toEqual([])

    // Once both ids are real, the fetch fires.
    mock.onGet('/fismasystems/1/questions').reply(200, { data: [] })
    mock
      .onGet('scores?datacallid=1&fismasystemid=1&include=functionoption')
      .reply(200, { data: [] })
    rerender({ s: 1, d: 1 })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mock.history.get).toHaveLength(2)
  })

  test('swallows network errors and stops loading (logs to console)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mock.onGet('/fismasystems/7/questions').networkError()
    mock
      .onGet('scores?datacallid=4&fismasystemid=7&include=functionoption')
      .networkError()

    const { result } = renderHook(() => useQuestionBreakdown(7, 4))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows).toEqual([])
    expect(spy).toHaveBeenCalledWith(
      'Failed to load question breakdown',
      expect.anything()
    )
    spy.mockRestore()
  })

  test('unmount before resolution does not log a state-on-unmounted warning', async () => {
    // Hold the questions request open so unmount happens mid-flight; jsdom
    // does not truly abort, but the controller.signal.aborted check inside
    // the hook's finally block must skip setLoading(false) when aborted.
    let resolveQ: (value: [number, unknown]) => void = () => {}
    mock
      .onGet('/fismasystems/7/questions')
      .reply(() => new Promise<[number, unknown]>((res) => (resolveQ = res)))
    mock
      .onGet('scores?datacallid=4&fismasystemid=7&include=functionoption')
      .reply(200, { data: [] })

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderHook(() => useQuestionBreakdown(7, 4))
    unmount()
    // Resolve after unmount; if the hook tried to setState now, React 18
    // would log a console.error - the spy below catches it.
    resolveQ([200, { data: questions }])
    await new Promise((r) => setTimeout(r, 0))
    const stateOnUnmountedWarning = errSpy.mock.calls.find(
      ([msg]) => typeof msg === 'string' && /unmounted/i.test(msg)
    )
    expect(stateOnUnmountedWarning).toBeUndefined()
    errSpy.mockRestore()
  })
})
