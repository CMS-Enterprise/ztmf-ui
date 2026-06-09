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
    | { data?: unknown; error?: unknown }
    | undefined

  // Field-level validation: a 400 whose data is a { field: reason } map.
  if (status === 400 && isStringMap(body?.data)) {
    const fieldErrors = body!.data as Record<string, string>
    return {
      status,
      fieldErrors,
      message:
        typeof body?.error === 'string' ? body.error : ERROR_MESSAGES.tryAgain,
    }
  }

  if (status === 403) {
    return { status, message: ERROR_MESSAGES.permission }
  }

  if (typeof body?.error === 'string' && body.error.length > 0) {
    return { status, message: body.error }
  }

  return { status, message: ERROR_MESSAGES.tryAgain }
}
