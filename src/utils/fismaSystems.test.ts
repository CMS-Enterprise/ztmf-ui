import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import { queryKeys } from '@/api/keys'
import axiosInstance from '@/axiosConfig'
import { notify } from '@/utils/notify'
import {
  setTargetMaturity,
  useFismaSystem,
  useFismaSystems,
  useSetTargetMaturity,
} from './fismaSystems'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)
const mockedNotify = notify as jest.Mock
beforeEach(() => mockedNotify.mockClear())
afterEach(() => mock.reset())

const SYSTEM_ID = 1002
const URL = `/fismasystems/${SYSTEM_ID}/target-maturity`
const INPUT = {
  target_maturity_tier: 'Advanced',
  target_maturity_justification: 'Risk accepted by the business owner.',
}
const SAVED = {
  fismasystemid: SYSTEM_ID,
  target_maturity_tier: 'Advanced',
} as unknown as FismaSystemType

describe('useFismaSystem', () => {
  // TanStack Query rejects a queryFn that resolves undefined, so returning it
  // for a served "no such system" would fail the query and retry a request
  // the server already answered.
  it('resolves a served null to null rather than failing the query', async () => {
    mock.onGet(`/fismasystems/${SYSTEM_ID}`).reply(200, { data: null })

    const { result } = renderHook(
      () => useFismaSystem(SYSTEM_ID, { enabled: true }),
      { wrapper: queryWrapper(createTestQueryClient()) }
    )

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeNull()
    expect(mock.history.get).toHaveLength(1)
  })
})

describe('setTargetMaturity', () => {
  it('puts the tier and justification and returns the echoed record', async () => {
    mock.onPut(URL).reply(200, { data: SAVED })

    await expect(setTargetMaturity(SYSTEM_ID, INPUT)).resolves.toEqual(SAVED)
    expect(JSON.parse(mock.history.put[0].data)).toEqual(INPUT)
  })

  it('returns undefined when a 200 carries no record', async () => {
    mock.onPut(URL).reply(200, { data: null })

    // Returned rather than thrown, so the card can show its own message for
    // this case instead of the generic network one.
    await expect(setTargetMaturity(SYSTEM_ID, INPUT)).resolves.toBeUndefined()
  })
})

describe('useSetTargetMaturity', () => {
  it("invalidates that system's detail key on success", async () => {
    mock.onPut(URL).reply(200, { data: SAVED })
    const client = createTestQueryClient()
    client.setQueryData(queryKeys.fismaSystems.detail(SYSTEM_ID), {})
    // A second system's entry, to prove the invalidation is scoped.
    client.setQueryData(queryKeys.fismaSystems.detail(2003), {})

    const { result } = renderHook(() => useSetTargetMaturity(SYSTEM_ID), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {
      await result.current.mutateAsync(INPUT)
    })

    expect(
      client.getQueryState(queryKeys.fismaSystems.detail(SYSTEM_ID))
        ?.isInvalidated
    ).toBe(true)
    expect(
      client.getQueryState(queryKeys.fismaSystems.detail(2003))?.isInvalidated
    ).toBe(false)
  })
})

describe('useFismaSystems on a failed load', () => {
  // The OpDiv dashboard renders this failure itself, through fismaSystemsError. A
  // snackbar beside its panel reports the same thing twice, and the code this
  // replaced only logged.
  it('reports the error without raising a snackbar', async () => {
    mock.onGet(new RegExp('^/fismasystems')).reply(500)

    const { result } = renderHook(
      () => useFismaSystems(false, { enabled: true }),
      {
        wrapper: queryWrapper(createTestQueryClient()),
      }
    )

    await waitFor(() => expect(result.current.fismaSystemsError).toBe(true))
    expect(mockedNotify).not.toHaveBeenCalled()
  })
})

describe('useFismaSystems across a decommissioned toggle', () => {
  const ACTIVE = { fismasystemid: 1 } as unknown as FismaSystemType
  const WITH_DECOMM = { fismasystemid: 2 } as unknown as FismaSystemType

  // Emptying the list mid-toggle reads as "no systems" to everything
  // downstream: the header count drops to 0 and the table's environment
  // options vanish, which trips its own effect into clearing that filter.
  it('keeps the previous rows on screen while the other list loads', async () => {
    mock.onGet('/fismasystems').reply(200, { data: [ACTIVE] })
    let release: (
      value: [number, { data: FismaSystemType[] }]
    ) => void = () => {}
    mock.onGet('/fismasystems?decommissioned=true').reply(
      () =>
        new Promise<[number, { data: FismaSystemType[] }]>((resolve) => {
          release = resolve
        })
    )

    const { result, rerender } = renderHook(
      ({ d }) => useFismaSystems(d, { enabled: true }),
      {
        wrapper: queryWrapper(createTestQueryClient()),
        initialProps: { d: false },
      }
    )
    await waitFor(() => expect(result.current.fismaSystems).toHaveLength(1))

    rerender({ d: true })

    expect(result.current.fismaSystems).toEqual([ACTIVE])
    // The rows on screen are still the active-only ones, so this has to say
    // so even though the flag being asked for is now true.
    expect(result.current.fismaSystemsFetchedDecommissioned).toBe(false)

    await act(async () => {
      release([200, { data: [ACTIVE, WITH_DECOMM] }])
    })
    await waitFor(() =>
      expect(result.current.fismaSystemsFetchedDecommissioned).toBe(true)
    )
    expect(result.current.fismaSystems).toHaveLength(2)
  })
})
