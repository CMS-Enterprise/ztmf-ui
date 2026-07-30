import type { AxiosError } from 'axios'
import { ERROR_MESSAGES } from '@/constants'
import { Routes } from '@/router/constants'
import { AuthCodes, SignInReasons } from '@/utils/authCodes'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: {
    navigate: jest.fn(),
    revalidate: jest.fn(),
    state: {
      location: { pathname: '/' },
      navigation: { location: undefined },
      revalidation: 'idle',
      // Keyed by route id; 'root' is RouteIds.ROOT (factory can't reference
      // the enum). status 200 = the stale-active-session shape #606 fixes.
      loaderData: { root: { status: 200 } },
    },
  },
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
const mockedRevalidate = (router as unknown as { revalidate: jest.Mock })
  .revalidate
const mockedNotify = notify as jest.Mock
const mockedRouter = router as unknown as {
  state: {
    location: { pathname: string }
    navigation: { location?: { pathname: string } }
    revalidation: 'idle' | 'loading'
    loaderData: Record<string, { status?: number; ok?: boolean }>
  }
}

function setCurrentPath(pathname: string): void {
  mockedRouter.state.location.pathname = pathname
}

function setPendingPath(pathname: string | undefined): void {
  mockedRouter.state.navigation.location = pathname ? { pathname } : undefined
}

function setRootLoaderStatus(status: number | undefined): void {
  mockedRouter.state.loaderData.root = status ? { status } : { ok: false }
}

function makeError(
  status: number | undefined,
  data?: unknown,
  config: { skipAuthHandling?: boolean } = {}
): AxiosError<{ error?: string; code?: string }> {
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
  } as unknown as AxiosError<{ error?: string; code?: string }>
}

beforeEach(() => {
  mockedNavigate.mockReset()
  mockedRevalidate.mockReset()
  mockedNotify.mockReset()
  // Default: dashboard state - not on the sign-in route, no navigation in
  // flight, and loader data still claiming an active session (the stale
  // shape a surprise 401 arrives against).
  setCurrentPath('/')
  setPendingPath(undefined)
  setRootLoaderStatus(200)
  mockedRouter.state.revalidation = 'idle'
})

test('401 redirects to sign-in with the expired-session message and reason', async () => {
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
    replace: true,
    state: {
      message: ERROR_MESSAGES.expired,
      reason: SignInReasons.EXPIRED,
    },
  })
  expect(mockedNotify).not.toHaveBeenCalled()
})

test('403 with ACCOUNT_NOT_PROVISIONED redirects to sign-in as NO_ACCOUNT and suppresses the toast', async () => {
  const error = makeError(403, {
    code: AuthCodes.ACCOUNT_NOT_PROVISIONED,
    error:
      'your authenticated identity does not have a ZTMF account; contact your administrator to request access',
  })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
    replace: true,
    state: {
      message:
        'your authenticated identity does not have a ZTMF account; contact your administrator to request access',
      reason: SignInReasons.NO_ACCOUNT,
    },
  })
  expect(mockedNotify).not.toHaveBeenCalled()
})

test('403 with ACCOUNT_NOT_PROVISIONED and no message body falls back to the permission copy', async () => {
  const error = makeError(403, { code: AuthCodes.ACCOUNT_NOT_PROVISIONED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
    replace: true,
    state: {
      message: ERROR_MESSAGES.permission,
      reason: SignInReasons.NO_ACCOUNT,
    },
  })
  expect(mockedNotify).not.toHaveBeenCalled()
})

test('403 with FORBIDDEN_ORIGIN fires the generic permission snackbar (defensive)', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const error = makeError(403, { code: AuthCodes.FORBIDDEN_ORIGIN })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNotify).toHaveBeenCalledWith(ERROR_MESSAGES.permission, 'error')
  expect(mockedNavigate).not.toHaveBeenCalled()
  consoleSpy.mockRestore()
})

test('403 with no code fires the generic permission snackbar (controller-level path)', async () => {
  const error = makeError(403, {})

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNotify).toHaveBeenCalledWith(ERROR_MESSAGES.permission, 'error')
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('403 with no code surfaces the backend message when response.data.error is set', async () => {
  const error = makeError(403, { error: 'No access to this datacall' })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNotify).toHaveBeenCalledWith(
    'No access to this datacall',
    'error'
  )
})

test('skipAuthHandling on the request config bypasses every branch', async () => {
  const error = makeError(
    403,
    { code: AuthCodes.ACCOUNT_NOT_PROVISIONED, error: 'ignored' },
    { skipAuthHandling: true }
  )

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

test('401 does not re-navigate when already on the sign-in route (#606 loop-guard)', async () => {
  setCurrentPath(Routes.SIGNIN)
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  // Redundant redirect suppressed. (Dedupe only - the loop itself is broken
  // by the revalidate() call, pinned further down.)
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('the sign-in route guard tolerates a trailing slash and casing', async () => {
  setCurrentPath('/SignIn/')
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('403 ACCOUNT_NOT_PROVISIONED still navigates when already on sign-in so the terminal state wins', async () => {
  // A NO_ACCOUNT diagnosis must not be swallowed just because an EXPIRED
  // redirect from the same burst got there first: the terminal "contact your
  // administrator" copy (no retry CTA) is the correct surface.
  setCurrentPath(Routes.SIGNIN)
  const error = makeError(403, { code: AuthCodes.ACCOUNT_NOT_PROVISIONED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
    replace: true,
    state: {
      message: ERROR_MESSAGES.permission,
      reason: SignInReasons.NO_ACCOUNT,
    },
  })
})

test('401 does not re-navigate while a navigation to sign-in is already pending (#606 burst)', async () => {
  // A burst of concurrent 401s: the first already started the /signin
  // navigation, whose loader has not committed yet, so state.location still
  // shows the old route. The rest of the burst must not interrupt and
  // restart it.
  setCurrentPath('/')
  setPendingPath(Routes.SIGNIN)
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('a pending navigation to a non-sign-in route does not suppress the redirect', async () => {
  setCurrentPath('/')
  setPendingPath('/users')
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
    replace: true,
    state: {
      message: ERROR_MESSAGES.expired,
      reason: SignInReasons.EXPIRED,
    },
  })
})

test('401 with stale active-session loader data revalidates the root loader before navigating (#606)', async () => {
  // The actual loop-breaker: navigate('/signin') alone does not re-run the
  // still-matched root authLoader, so LoginPage would see stale status===200
  // and bounce back to the dashboard forever.
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedRevalidate).toHaveBeenCalled()
  // Revalidate first so the /signin navigation commits with fresh loader data.
  expect(mockedRevalidate.mock.invocationCallOrder[0]).toBeLessThan(
    mockedNavigate.mock.invocationCallOrder[0]
  )
})

test('401 while loader data already reports no session does not fire a redundant revalidation', async () => {
  setRootLoaderStatus(undefined)
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedRevalidate).not.toHaveBeenCalled()
})

test('401 suppressed by the sign-in guard still revalidates stale loader data', async () => {
  // Being on /signin with loader data claiming an active session is exactly
  // the mid-bounce state - skipping the redirect must not skip the fix.
  setCurrentPath(Routes.SIGNIN)
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedNavigate).not.toHaveBeenCalled()
  expect(mockedRevalidate).toHaveBeenCalled()
})

test('403 ACCOUNT_NOT_PROVISIONED with stale loader data also revalidates', async () => {
  const error = makeError(403, { code: AuthCodes.ACCOUNT_NOT_PROVISIONED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedRevalidate).toHaveBeenCalled()
})

test('401 while a revalidation is already in flight does not re-fire revalidate', async () => {
  // Stragglers in a 401 burst arrive while the first rejection's forced
  // loader re-run is still pending (loaderData is stale until it lands);
  // re-firing revalidate() would restart the /signin navigation's loader
  // run for no benefit.
  mockedRouter.state.revalidation = 'loading'
  const error = makeError(401, { code: AuthCodes.UNAUTHORIZED })

  await expect(handleAuthError(error)).rejects.toMatchObject({
    __authHandled: true,
  })
  expect(mockedRevalidate).not.toHaveBeenCalled()
})
