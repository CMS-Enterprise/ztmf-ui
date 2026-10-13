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
import { sendMassEmail, useSendMassEmail } from './massEmails'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const INPUT = { group: 'ISSO', subject: 'Data call opens Monday', body: 'Hi' }

describe('sendMassEmail', () => {
  it('posts the group, subject and body and unwraps the recipient list', async () => {
    mock.onPost('/massemails').reply(200, { data: ['a@cms.hhs.gov'] })

    await expect(sendMassEmail(INPUT)).resolves.toEqual(['a@cms.hhs.gov'])
    expect(JSON.parse(mock.history.post[0].data)).toEqual(INPUT)
  })

  it('coerces a null recipient list to an empty array', async () => {
    mock.onPost('/massemails').reply(200, { data: null })

    // The modal renders the list length, so a null would read as a crash
    // rather than as "sent to nobody".
    await expect(sendMassEmail(INPUT)).resolves.toEqual([])
  })
})

describe('useSendMassEmail', () => {
  it('invalidates nothing, since the send changes no state this app reads', async () => {
    mock.onPost('/massemails').reply(200, { data: [] })
    const client = createTestQueryClient()
    client.setQueryData(queryKeys.users.all, [])
    client.setQueryData(queryKeys.datacalls.all, [])

    const { result } = renderHook(() => useSendMassEmail(), {
      wrapper: queryWrapper(client),
    })
    await act(async () => {
      await result.current.mutateAsync(INPUT)
    })

    expect(client.getQueryState(queryKeys.users.all)?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.datacalls.all)?.isInvalidated).toBe(
      false
    )
  })
})
