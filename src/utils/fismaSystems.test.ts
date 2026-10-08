import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import { act, renderHook } from '@testing-library/react'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { queryWrapper } from '@/test-utils/queryWrapper'
import { queryKeys } from '@/api/keys'
import axiosInstance from '@/axiosConfig'
import { setTargetMaturity, useSetTargetMaturity } from './fismaSystems'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)
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
