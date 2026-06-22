// Split out of axiosConfig.ts so tests can import the handler without
// parsing the Vite-only `import.meta.env` line at the top of that file
// (jest's swc transform leaves `import.meta` in the CommonJS output and
// node throws "Cannot use 'import.meta' outside a module" at load time).
import type { AxiosError } from 'axios'
import router from '@/router/router'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
import { markAuthHandled, notify } from '@/utils/notify'

/**
 * Centralized 401/403 handling for axios responses. Registered as the
 * response interceptor's rejection callback in axiosConfig.
 *
 * - 401: navigates to sign-in with the "session expired" message.
 * - 403: surfaces response.data.error if present, else the generic
 *   permission message, via notify().
 * - skipAuthHandling on the request config bypasses both branches.
 * - All other statuses (and network errors) pass through untouched.
 *
 * 401 and 403 errors are tagged with __authHandled so caller catch
 * blocks can short-circuit via isAuthHandled.
 *
 * @param error - The rejected AxiosError. The response body is narrowed
 *   to `{ error?: string }` so the 403 branch can read it directly.
 * @returns A rejected promise. Always rejects, never resolves.
 */
export async function handleAuthError(
  error: AxiosError<{ error?: string }>
): Promise<never> {
  if (error.config?.skipAuthHandling) {
    throw error
  }
  const status = error.response?.status
  if (status === 401) {
    router.navigate(Routes.SIGNIN, {
      replace: true,
      state: { message: ERROR_MESSAGES.expired },
    })
    throw markAuthHandled(error)
  }
  if (status === 403) {
    const backendMessage = error.response?.data?.error
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
