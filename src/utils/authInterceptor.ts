// Split out of axiosConfig.ts so tests can import the handler without
// parsing the Vite-only `import.meta.env` line at the top of that file
// (jest's swc transform leaves `import.meta` in the CommonJS output and
// node throws "Cannot use 'import.meta' outside a module" at load time).
import type { AxiosError } from 'axios'
import router from '@/router/router'
import { Routes } from '@/router/constants'
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

  if (status === 401) {
    router.navigate(Routes.SIGNIN, {
      replace: true,
      state: {
        message: ERROR_MESSAGES.expired,
        reason: SignInReasons.EXPIRED,
      },
    })
    throw markAuthHandled(error)
  }
  if (status === 403) {
    if (code === AuthCodes.ACCOUNT_NOT_PROVISIONED) {
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
