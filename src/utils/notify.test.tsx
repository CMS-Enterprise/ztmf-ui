import { DEFAULT_ALERT_TIMEOUT } from '@/constants'

jest.mock('notistack', () => ({
  __esModule: true,
  enqueueSnackbar: jest.fn(),
}))

import { enqueueSnackbar } from 'notistack'
import { isAuthHandled, markAuthHandled, notify } from './notify'

const mockedEnqueue = enqueueSnackbar as unknown as jest.Mock

beforeEach(() => {
  mockedEnqueue.mockReset()
})

test('notify forwards to notistack with the project defaults', () => {
  notify('hello', 'success')

  expect(mockedEnqueue).toHaveBeenCalledWith('hello', {
    anchorOrigin: { vertical: 'top', horizontal: 'left' },
    autoHideDuration: DEFAULT_ALERT_TIMEOUT,
    variant: 'success',
  })
})

test('notify lets per-call overrides win over the defaults', () => {
  notify('persisted', 'warning', {
    persist: true,
    anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
  })

  expect(mockedEnqueue).toHaveBeenCalledWith('persisted', {
    anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
    autoHideDuration: DEFAULT_ALERT_TIMEOUT,
    variant: 'warning',
    persist: true,
  })
})

test('markAuthHandled tags the error and isAuthHandled detects it', () => {
  const error = new Error('boom') as Error & { __authHandled?: true }
  expect(isAuthHandled(error)).toBe(false)
  markAuthHandled(error)
  expect(isAuthHandled(error)).toBe(true)
})

test('isAuthHandled returns false for non-objects and untagged values', () => {
  expect(isAuthHandled(null)).toBe(false)
  expect(isAuthHandled(undefined)).toBe(false)
  expect(isAuthHandled('not an error')).toBe(false)
  expect(isAuthHandled({})).toBe(false)
  expect(isAuthHandled({ __authHandled: false })).toBe(false)
})
