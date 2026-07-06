import { isAxiosError } from 'axios'
import { ERROR_MESSAGES } from '@/constants'

/**
 * Normalized view of a backend error response.
 *
 * Every endpoint uses the envelope { data, error } with a real HTTP status.
 * On a 400 from a create/update, `data` is a map of field -> human-readable
 * reason (e.g. { code: "an OpDiv with this code already exists" }); render
 * those inline on the form. For 403/404/500 there is no field map, so callers
 * fall back to `message` for a toast.
 */
export type ParsedApiError = {
  status?: number
  /** field -> reason, present only when the 400 body carried a data map */
  fieldErrors?: Record<string, string>
  /** human-readable fallback for a toast */
  message: string
  /**
   * Stable error code from the BE auth middleware (e.g. ACCOUNT_NOT_PROVISIONED).
   * Mirrored in src/utils/authCodes.ts. Present only on middleware rejections;
   * controller-level errors do not set it.
   */
  code?: string
}

const isStringMap = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0 &&
  Object.values(value).every((v) => typeof v === 'string')

export function parseApiError(error: unknown): ParsedApiError {
  if (!isAxiosError(error)) {
    return { message: ERROR_MESSAGES.tryAgain }
  }

  const status = error.response?.status
  const body = error.response?.data as
    | { data?: unknown; error?: unknown; code?: unknown }
    | undefined
  const code = typeof body?.code === 'string' ? body.code : undefined

  // Field-level validation: a 400 whose data is a { field: reason } map.
  if (status === 400 && isStringMap(body?.data)) {
    const fieldErrors = body!.data as Record<string, string>
    return {
      status,
      fieldErrors,
      message:
        typeof body?.error === 'string' ? body.error : ERROR_MESSAGES.tryAgain,
      code,
    }
  }

  // 403 with a code is a middleware rejection (e.g. ACCOUNT_NOT_PROVISIONED) and
  // carries an honest backend message worth surfacing. 403 without a code is a
  // controller-level rejection (IsAdmin etc.) whose body text is not user-facing,
  // so fall back to the generic permission copy.
  if (status === 403) {
    if (code && typeof body?.error === 'string' && body.error.length > 0) {
      return { status, message: body.error, code }
    }
    return { status, message: ERROR_MESSAGES.permission, code }
  }

  if (typeof body?.error === 'string' && body.error.length > 0) {
    return { status, message: body.error, code }
  }

  return { status, message: ERROR_MESSAGES.tryAgain, code }
}
