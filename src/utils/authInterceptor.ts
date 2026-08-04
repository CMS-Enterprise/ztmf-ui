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

  // Navigating to /signin leaves the root route matched, so react-router does
  // not re-run its loader: loaderData keeps reporting status 200, LoginPage
  // trusts it and <Navigate>s back to the dashboard, whose mount 401s again
  // (#606). revalidate() is what breaks that cycle, so it must stay OUTSIDE
  // the redirect guards below - a suppressed redirect still needs fresh data.
  // Path normalization mirrors Title.tsx.
  const normalizePath = (pathname: string | undefined) =>
    (pathname ?? '').toLowerCase().replace(/\/$/, '')
  const signInPath = Routes.SIGNIN.toLowerCase()
  const onSignIn = (loc?: { pathname?: string }) =>
    normalizePath(loc?.pathname) === signInPath
  const alreadyOnSignIn =
    onSignIn(router.state?.location) ||
    onSignIn(router.state?.navigation?.location)
  const backendMessageOrPermission =
    typeof backendMessage === 'string' && backendMessage.length > 0
      ? backendMessage
      : ERROR_MESSAGES.permission
  // NO_ACCOUNT cannot reuse alreadyOnSignIn: an EXPIRED redirect landing first
  // in a burst would suppress the more specific diagnosis. Keying on reason
  // dedupes it against itself instead. The message is part of the key because
  // LoginPage prefers location.state.message, so a body-less 403 that fell back
  // to generic copy would otherwise freeze out a later one carrying the real
  // text.
  const showingNoAccount = (loc?: { pathname?: string; state?: unknown }) => {
    if (!onSignIn(loc)) return false
    const locState = loc?.state as
      | { reason?: string; message?: string }
      | null
      | undefined
    return (
      locState?.reason === SignInReasons.NO_ACCOUNT &&
      locState?.message === backendMessageOrPermission
    )
  }
  const alreadyShowingNoAccount =
    showingNoAccount(router.state?.location) ||
    showingNoAccount(router.state?.navigation?.location)
  const rootLoaderData = router.state?.loaderData?.[RouteIds.ROOT] as
    | { status?: number }
    | undefined
  // loaderData stays stale until a revalidation lands, so without the in-flight
  // check every straggler in a burst would restart the pending navigation.
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
      if (!alreadyShowingNoAccount) {
        router.navigate(Routes.SIGNIN, {
          replace: true,
          state: {
            message: backendMessageOrPermission,
            reason: SignInReasons.NO_ACCOUNT,
          },
        })
      }
      throw markAuthHandled(error)
    }
    if (code === AuthCodes.FORBIDDEN_ORIGIN) {
      console.error('FORBIDDEN_ORIGIN from API; request blocked by CSRF guard')
      notify(ERROR_MESSAGES.permission, 'error')
      throw markAuthHandled(error)
    }
    notify(backendMessageOrPermission, 'error')
    throw markAuthHandled(error)
  }
  throw error
}
