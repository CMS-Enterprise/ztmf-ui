import MockAdapter from 'axios-mock-adapter'
import { apiPaths } from '@/api/keys'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  const { handleAuthError } = require('@/utils/authInterceptor')
  const instance = axios.create({ baseURL: 'api/v1/' })
  instance.interceptors.response.use(
    (response: unknown) => response,
    handleAuthError
  )
  return { __esModule: true, default: instance }
})

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), revalidate: jest.fn(), state: {} },
}))

import axiosInstance from '@/axiosConfig'
import { addSystemDelegate } from './delegates'

const mock = new MockAdapter(axiosInstance)

afterEach(() => {
  mock.reset()
})

test('lets the caller handle a capability-off add rejection', async () => {
  const body = { email: 'delegate@example.com' }
  mock.onPost(apiPaths.fismaSystems.delegates(42)).reply(403, {
    code: 'DELEGATE_NOT_ENABLED',
  })

  await expect(addSystemDelegate(42, body)).rejects.toMatchObject({
    response: { status: 403 },
  })

  expect(mock.history.post).toHaveLength(1)
  expect(mock.history.post[0].skipAuthHandling).toBe(true)
})
