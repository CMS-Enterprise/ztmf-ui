// Two concerns live here:
// 1. notify() centralizes project-wide snackbar defaults so callers
//    use one helper instead of repeating anchor/duration settings.
// 2. The __authHandled marker (markAuthHandled + isAuthHandled) that
//    the interceptor and every caller's catch share as a contract.
import {
  enqueueSnackbar,
  type OptionsObject,
  type VariantType,
} from 'notistack'
import { DEFAULT_ALERT_TIMEOUT } from '@/constants'

const DEFAULT_OPTIONS: OptionsObject = {
  anchorOrigin: { vertical: 'top', horizontal: 'left' },
  autoHideDuration: DEFAULT_ALERT_TIMEOUT,
}

/**
 * Fires a snackbar using project-standard defaults.
 * Use this helper when you want consistent anchor/duration behavior.
 *
 * @param message - Text rendered in the snackbar.
 * @param variant - notistack severity. Defaults to 'default'.
 * @param overrides - Partial options merged on top of the defaults
 *   (top-left anchor, DEFAULT_ALERT_TIMEOUT duration).
 */
export function notify(
  message: string,
  variant: VariantType = 'default',
  overrides: OptionsObject = {}
): void {
  enqueueSnackbar(message, { ...DEFAULT_OPTIONS, variant, ...overrides })
}

type AuthHandledError = { __authHandled?: true }

/**
 * Type guard for the __authHandled marker. Caller catch blocks use
 * this to skip a generic fallback snackbar when the interceptor
 * already surfaced the error.
 *
 * @param error - Any value caught from a rejected request.
 * @returns true when tagged by markAuthHandled, false otherwise.
 */
export function isAuthHandled(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as AuthHandledError).__authHandled === true
  )
}

/**
 * Tags an axios error as handled by the interceptor. Only the auth
 * interceptor should call this; views read the tag via isAuthHandled.
 *
 * @typeParam E - The error's object type, preserved on the return.
 * @param error - The error to tag. Mutated in place.
 * @returns The same reference, now typed with __authHandled.
 */
export function markAuthHandled<E extends object>(
  error: E
): E & AuthHandledError {
  return Object.assign(error, { __authHandled: true as const })
}
