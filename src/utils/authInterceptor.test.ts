import type { AxiosError } from 'axios'
import { ERROR_MESSAGES } from '@/constants'
import { Routes } from '@/router/constants'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

jest.mock('@/utils/notify', () => ({
  __esModule: true,
  notify: jest.fn(),
  markAuthHandled: (e: object) => Object.assign(e, { __authHandled: true }),
}))

import router from '@/router/router'
import { notify } from '@/utils/notify'
import { handleAuthError } from './authInterceptor'

const mockedNavigate = (router as unknown as { navigate: jest.Mock }).navigate
const mockedNotify = notify as jest.Mock

function makeError(
  status: number | undefined,
  data?: unknown,
  config: { skipAuthHandling?: boolean } = {}
): AxiosError<{ error?: string }> {
  return {
    config,
    response:
      status === undefined
        ? undefined
        : { status, data, statusText: '', headers: {}, config },
    isAxiosError: true,
    toJSON: () => ({}),
    name: 'AxiosError',
    message: 'mock',
  } as unknown as AxiosError<{ error?: string }>
}

beforeEach(() => {
  mockedNavigate.mockReset()
  mockedNotify.mockReset()
})

test('401 redirects to sign-in with the expired-session message', async () => {
  const error = makeError(401)

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
    replace: true,
    state: { message: ERROR_MESSAGES.expired },
  })
  expect(mockedNotify).not.toHaveBeenCalled()
})

test('403 fires the generic permission snackbar when no backend message', async () => {
  const error = makeError(403, {})

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNotify).toHaveBeenCalledWith(ERROR_MESSAGES.permission, 'error')
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('403 surfaces the backend message when response.data.error is set', async () => {
  const error = makeError(403, { error: 'No access to this datacall' })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNotify).toHaveBeenCalledWith(
    'No access to this datacall',
    'error'
  )
})

test('skipAuthHandling on the request config bypasses both branches', async () => {
  const error = makeError(403, { error: 'ignored' }, { skipAuthHandling: true })

  await expect(handleAuthError(error)).rejects.toBe(error)
  expect(mockedNavigate).not.toHaveBeenCalled()
  expect(mockedNotify).not.toHaveBeenCalled()
})

test('non-auth statuses pass through untouched', async () => {
  const error = makeError(500)

  await expect(handleAuthError(error)).rejects.toBe(error)
  expect(mockedNavigate).not.toHaveBeenCalled()
  expect(mockedNotify).not.toHaveBeenCalled()
})

test('network errors with no response pass through untouched', async () => {
  const error = makeError(undefined)

  await expect(handleAuthError(error)).rejects.toBe(error)
  expect(mockedNavigate).not.toHaveBeenCalled()
  expect(mockedNotify).not.toHaveBeenCalled()
})
