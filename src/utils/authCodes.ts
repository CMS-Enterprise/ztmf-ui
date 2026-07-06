/**
 * Mirrors the BE auth package's response-body codes (see
 * backend/cmd/api/internal/auth/middleware.go). The FE branches on these
 * to distinguish "session expired" from "authenticated but no app
 * account" without resorting to message-string matching.
 *
 * Keep in lockstep with the BE side: any new code added in middleware.go
 * should land here too, and a grep for the literal should turn up here
 * first.
 */
export const AuthCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCOUNT_NOT_PROVISIONED: 'ACCOUNT_NOT_PROVISIONED',
  FORBIDDEN_ORIGIN: 'FORBIDDEN_ORIGIN',
} as const

export type AuthCode = (typeof AuthCodes)[keyof typeof AuthCodes]

/**
 * Reason surfaced on the /signin route's location.state and on the
 * authLoader's discriminated return. The LoginPage keys off this to pick
 * between the terminal "no account" UX and the retryable "session
 * expired" UX.
 */
export const SignInReasons = {
  NO_ACCOUNT: 'NO_ACCOUNT',
  EXPIRED: 'EXPIRED',
} as const

export type SignInReason = (typeof SignInReasons)[keyof typeof SignInReasons]
