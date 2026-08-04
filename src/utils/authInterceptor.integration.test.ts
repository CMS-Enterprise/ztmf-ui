/**
 * The #606 loop fix against a REAL router. authInterceptor.test.ts mocks the
 * router, so it can pin that revalidate() runs before navigate() but not that
 * the loop stops. That matters because the fix relies on react-router keeping
 * its internal isRevalidationRequired flag across the interrupting navigation -
 * public behavior of a private detail, so a version bump could regress #606
 * with every mocked test still green. These assert the outcome instead: the
 * /signin navigation commits with FRESH loader data.
 */
import type { AxiosError } from 'axios'
import { createMemoryRouter } from 'react-router-dom'
import { AuthCodes, SignInReasons } from '@/utils/authCodes'
import { Routes, RouteIds } from '@/router/constants'

// The interceptor imports the router singleton; point that import at whichever
// memory router the current test built. Getters resolve lazily, so it stays live.
const mockRouterRef: { current: ReturnType<typeof createMemoryRouter> | null } =
  { current: null }

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: {
    get state() {
      return mockRouterRef.current?.state
    },
    navigate: (...args: unknown[]) =>
      (
        mockRouterRef.current?.navigate as unknown as (
          ...a: unknown[]
        ) => Promise<void>
      )(...args),
    revalidate: () => mockRouterRef.current?.revalidate(),
  },
}))

jest.mock('@/utils/notify', () => ({
  __esModule: true,
  notify: jest.fn(),
  markAuthHandled: (e: object) => Object.assign(e, { __authHandled: true }),
}))

import { handleAuthError } from './authInterceptor'

// Mirrors authLoader's discriminated return.
let sessionAlive = true
let rootLoaderRuns = 0

function rootLoader() {
  rootLoaderRuns++
  return sessionAlive
    ? { status: 200, response: { userid: 'u1' } }
    : { ok: false, reason: SignInReasons.EXPIRED, response: {} }
}

async function buildSignedInRouter() {
  sessionAlive = true
  rootLoaderRuns = 0
  const router = createMemoryRouter(
    [
      {
        id: RouteIds.ROOT,
        path: Routes.ROOT,
        loader: rootLoader,
        children: [
          { index: true, id: 'home' },
          { path: RouteIds.SIGNIN, id: RouteIds.SIGNIN },
        ],
      },
    ],
    { initialEntries: [Routes.ROOT] }
  )
  mockRouterRef.current = router
  router.initialize()
  await waitForIdle(router)
  expect(router.state.loaderData[RouteIds.ROOT]).toMatchObject({ status: 200 })
  return router
}

/**
 * Settle the router. It yields before checking, so `expectWorkStarted` asserts
 * something was actually in flight - otherwise an interceptor that ever awaited
 * before navigating would make the loader-count assertions vacuously pass.
 */
async function waitForIdle(
  router: ReturnType<typeof createMemoryRouter>,
  expectWorkStarted = false
): Promise<void> {
  if (expectWorkStarted) {
    const busy =
      router.state.navigation.state !== 'idle' ||
      router.state.revalidation !== 'idle'
    if (!busy) {
      throw new Error(
        'expected a navigation or revalidation to be in flight, but the router was idle'
      )
    }
  }
  for (let i = 0; i < 50; i++) {
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    if (
      router.state.initialized &&
      router.state.navigation.state === 'idle' &&
      router.state.revalidation === 'idle'
    ) {
      return
    }
  }
  throw new Error('router did not settle')
}

function authError(
  status: number,
  code: string
): AxiosError<{ error?: string; code?: string }> {
  return {
    config: {},
    response: {
      status,
      data: { code },
      statusText: '',
      headers: {},
      config: {},
    },
    isAxiosError: true,
    toJSON: () => ({}),
    name: 'AxiosError',
    message: 'mock',
  } as unknown as AxiosError<{ error?: string; code?: string }>
}

afterEach(() => {
  // Optional across versions, hence the guard.
  mockRouterRef.current?.dispose?.()
  mockRouterRef.current = null
})

test('a 401 against a signed-in dashboard lands on sign-in with FRESH loader data (#606)', async () => {
  const router = await buildSignedInRouter()

  // Session dies out from under the tab.
  sessionAlive = false
  const runsBefore = rootLoaderRuns

  await expect(
    handleAuthError(authError(401, AuthCodes.UNAUTHORIZED))
  ).rejects.toMatchObject({ __authHandled: true })
  await waitForIdle(router, true)

  expect(router.state.location.pathname).toBe(Routes.SIGNIN)
  // The load-bearing assertion: without revalidate() this still reads 200.
  expect(rootLoaderRuns).toBeGreaterThan(runsBefore)
  expect(router.state.loaderData[RouteIds.ROOT]).toMatchObject({
    ok: false,
    reason: SignInReasons.EXPIRED,
  })
  expect(router.state.loaderData[RouteIds.ROOT]).not.toMatchObject({
    status: 200,
  })
})

test('the sign-in navigation carries the expired reason for LoginPage', async () => {
  const router = await buildSignedInRouter()
  sessionAlive = false

  await expect(
    handleAuthError(authError(401, AuthCodes.UNAUTHORIZED))
  ).rejects.toMatchObject({ __authHandled: true })
  await waitForIdle(router, true)

  expect(router.state.location.state).toMatchObject({
    reason: SignInReasons.EXPIRED,
  })
})

test('a burst of 401s settles on sign-in once, without a redirect storm (#606)', async () => {
  const router = await buildSignedInRouter()
  sessionAlive = false
  const runsBefore = rootLoaderRuns

  // What a dashboard mount does: several requests rejecting together.
  await Promise.all(
    Array.from({ length: 4 }, () =>
      handleAuthError(authError(401, AuthCodes.UNAUTHORIZED)).catch(() => {})
    )
  )
  await waitForIdle(router, true)

  expect(router.state.location.pathname).toBe(Routes.SIGNIN)
  expect(router.state.loaderData[RouteIds.ROOT]).toMatchObject({ ok: false })
  // Empirical bound for a homogeneous burst: lands on exactly 2, and goes to
  // 5 without the guards. A mixed burst reaches 3 - separate test below.
  expect(rootLoaderRuns - runsBefore).toBeLessThanOrEqual(2)
})

test('a 403 ACCOUNT_NOT_PROVISIONED burst settles on the NO_ACCOUNT terminal state', async () => {
  const router = await buildSignedInRouter()
  sessionAlive = false
  const runsBefore = rootLoaderRuns

  await Promise.all(
    Array.from({ length: 4 }, () =>
      handleAuthError(authError(403, AuthCodes.ACCOUNT_NOT_PROVISIONED)).catch(
        () => {}
      )
    )
  )
  await waitForIdle(router, true)

  expect(router.state.location.pathname).toBe(Routes.SIGNIN)
  expect(router.state.location.state).toMatchObject({
    reason: SignInReasons.NO_ACCOUNT,
  })
  expect(rootLoaderRuns - runsBefore).toBeLessThanOrEqual(2)
})

test('a mixed 401/403 burst settles on NO_ACCOUNT with a bounded number of loader runs', async () => {
  // Interleaved: NO_ACCOUNT must win regardless of order, and runs stay
  // bounded. Costs one more run than a homogeneous burst, since the first 403
  // is allowed through to override the 401's EXPIRED redirect.
  const router = await buildSignedInRouter()
  sessionAlive = false
  const runsBefore = rootLoaderRuns

  await Promise.all(
    [401, 403, 401, 403, 401, 403].map((s) =>
      handleAuthError(
        authError(
          s,
          s === 401 ? AuthCodes.UNAUTHORIZED : AuthCodes.ACCOUNT_NOT_PROVISIONED
        )
      ).catch(() => {})
    )
  )
  await waitForIdle(router, true)

  expect(router.state.location.pathname).toBe(Routes.SIGNIN)
  expect(router.state.location.state).toMatchObject({
    reason: SignInReasons.NO_ACCOUNT,
  })
  expect(rootLoaderRuns - runsBefore).toBeLessThanOrEqual(3)
})

test('NO_ACCOUNT still overrides an EXPIRED redirect already committed', async () => {
  const router = await buildSignedInRouter()
  sessionAlive = false

  await handleAuthError(authError(401, AuthCodes.UNAUTHORIZED)).catch(() => {})
  await waitForIdle(router, true)
  expect(router.state.location.state).toMatchObject({
    reason: SignInReasons.EXPIRED,
  })

  // The more specific diagnosis arrives second and must win.
  await handleAuthError(
    authError(403, AuthCodes.ACCOUNT_NOT_PROVISIONED)
  ).catch(() => {})
  await waitForIdle(router, true)

  expect(router.state.location.state).toMatchObject({
    reason: SignInReasons.NO_ACCOUNT,
  })
})
