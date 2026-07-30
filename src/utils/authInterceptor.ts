// Split out of axiosConfig.ts so tests can import the handler without
// parsing the Vite-only `import.meta.env` line at the top of that file
// (jest's swc transform leaves `import.meta` in the CommonJS output and
// node throws "Cannot use 'import.meta' outside a module" at load time).
import type { AxiosError } from 'axios'
import router from '@/router/router'
import { RouteIds, Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
import { markAuthHandled, notify } from '@/utils/notify'
import { AuthCodes, SignInReasons } from '@/utils/authCodes'

/**
 * Centralized 401/403 handling for axios responses. Registered as the
 * response interceptor's rejection callback in axiosConfig.
 *
 * - 401: redirects to /signin with reason=EXPIRED and the "session
 *   expired" message.
 * - 403 with code=ACCOUNT_NOT_PROVISIONED: middleware says the
 *   authenticated identity has no app account (or is soft-deleted).
 *   Redirects to /signin with reason=NO_ACCOUNT and the backend message
 *   so LoginPage can render terminal copy with no retry CTA. No toast,
 *   since the page itself is the surface.
 * - 403 with code=FORBIDDEN_ORIGIN: CSRF guard tripped. Should not fire
 *   in the normal browser flow; log and show a generic toast so the
 *   failure is visible during development.
 * - 403 without a code: controller-level rejection (IsAdmin etc.).
 *   Existing behavior preserved - surfaces the backend message or the
 *   generic permission message via notify().
 * - skipAuthHandling on the request config bypasses everything.
 * - All other statuses (and network errors) pass through untouched.
 *
 * 401 and 403 errors are tagged with __authHandled so caller catch
 * blocks can short-circuit via isAuthHandled.
 *
 * @param error - The rejected AxiosError. The response body is narrowed
 *   to `{ error?: string; code?: string }` so both branches can read it
 *   directly without re-parsing through apiErrors.
 * @returns A rejected promise. Always rejects, never resolves.
 */
export async function handleAuthError(
  error: AxiosError<{ error?: string; code?: string }>
): Promise<never> {
  if (error.config?.skipAuthHandling) {
    throw error
  }
  const status = error.response?.status
  const code = error.response?.data?.code
  const backendMessage = error.response?.data?.error

  // #606: an auth failure here usually means the session died out from under
  // a still-rendered dashboard (logout in another tab, cookie expiry). Two
  // pieces of router state need correcting, and a plain navigate('/signin')
  // fixes only one of them:
  //
  // 1. The root authLoader's data. The root route stays matched on a child
  //    navigation, so react-router does NOT re-run its loader and loaderData
  //    keeps claiming status===200. LoginPage trusts that and <Navigate>s
  //    straight back to the dashboard, whose mount fetches 401 again - the
  //    reported "stuttering loop." router.revalidate() forces the authLoader
  //    to re-run; once it reports no session the bounce stops. Called before
  //    navigate() so the /signin navigation picks the revalidation up and
  //    commits with fresh loader data, and only when the data is actually
  //    stale so 401s while already signed out don't fire a redundant probe.
  //
  // 2. The location. Redirect to /signin carrying the reason so LoginPage
  //    renders the right copy. For a 401 this is skipped when the tab is
  //    already on (or already navigating to) the sign-in route - one redirect
  //    per burst of concurrent rejections is enough, and a late 401 must not
  //    clobber a NO_ACCOUNT terminal state already showing. NO_ACCOUNT itself
  //    always navigates: it is the more specific diagnosis and must win over
  //    a plain EXPIRED redirect from the same burst.
  //
  // Path normalization mirrors Title.tsx (lowercase + strip trailing slash).
  const normalizePath = (pathname: string | undefined) =>
    (pathname ?? '').toLowerCase().replace(/\/$/, '')
  const signInPath = Routes.SIGNIN.toLowerCase()
  const alreadyOnSignIn =
    normalizePath(router.state?.location?.pathname) === signInPath ||
    normalizePath(router.state?.navigation?.location?.pathname) === signInPath
  const rootLoaderData = router.state?.loaderData?.[RouteIds.ROOT] as
    | { status?: number }
    | undefined
  // Skip when a revalidation is already in flight: loaderData stays stale
  // until it completes, so each straggler in a 401 burst would otherwise
  // re-fire revalidate() and restart the pending /signin navigation's
  // loader run. One forced re-run is enough.
  const needsRevalidation =
    rootLoaderData?.status === 200 && router.state?.revalidation !== 'loading'

  if (status === 401) {
    if (needsRevalidation) void router.revalidate()
    if (!alreadyOnSignIn) {
      router.navigate(Routes.SIGNIN, {
        replace: true,
        state: {
          message: ERROR_MESSAGES.expired,
          reason: SignInReasons.EXPIRED,
        },
      })
    }
    throw markAuthHandled(error)
  }
  if (status === 403) {
    if (code === AuthCodes.ACCOUNT_NOT_PROVISIONED) {
      if (needsRevalidation) void router.revalidate()
      router.navigate(Routes.SIGNIN, {
        replace: true,
        state: {
          message:
            typeof backendMessage === 'string' && backendMessage.length > 0
              ? backendMessage
              : ERROR_MESSAGES.permission,
          reason: SignInReasons.NO_ACCOUNT,
        },
      })
      throw markAuthHandled(error)
    }
    if (code === AuthCodes.FORBIDDEN_ORIGIN) {
      console.error('FORBIDDEN_ORIGIN from API; request blocked by CSRF guard')
      notify(ERROR_MESSAGES.permission, 'error')
      throw markAuthHandled(error)
    }
    notify(
      typeof backendMessage === 'string' && backendMessage.length > 0
        ? backendMessage
        : ERROR_MESSAGES.permission,
      'error'
    )
    throw markAuthHandled(error)
  }
  throw error
}
