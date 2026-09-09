import MockAdapter from 'axios-mock-adapter'
import { apiPaths } from '@/api/keys'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { addSystemDelegate } from './delegates'

const mock = new MockAdapter(axiosInstance)

afterEach(() => {
  mock.reset()
})

test('lets the caller handle a capability-off add rejection', async () => {
  const body = { email: 'delegate@example.com' }
  mock.onPost(apiPaths.fismaSystems.delegates(42)).reply(201)

  await addSystemDelegate(42, body)

  expect(mock.history.post).toHaveLength(1)
  expect(mock.history.post[0].skipAuthHandling).toBe(true)
})
