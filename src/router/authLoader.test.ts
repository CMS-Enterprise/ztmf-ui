import { apiPaths } from '@/api/keys'
import { SignInReasons } from '@/utils/authCodes'

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

import axiosInstance from '@/axiosConfig'
import authLoader from './authLoader'

const mockedGet = axiosInstance.get as jest.Mock

beforeEach(() => {
  mockedGet.mockReset()
})

test('owns a session 401 and bypasses the redirect interceptor', async () => {
  mockedGet.mockRejectedValueOnce({ response: { status: 401 } })

  await expect(authLoader()).resolves.toMatchObject({
    ok: false,
    reason: SignInReasons.EXPIRED,
  })
  expect(mockedGet).toHaveBeenCalledWith(apiPaths.users.current, {
    skipAuthHandling: true,
  })
})
