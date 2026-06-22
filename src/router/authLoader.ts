import 'core-js/stable/atob'
import { userData, UserRole } from '@/types'
import axiosInstance from '@/axiosConfig'
import { AuthCodes, SignInReasons, type SignInReason } from '@/utils/authCodes'
/**
 * Auth state loader for react-router data routes.
 * @module router/authLoader
 * @see {@link dashboard/Routes}
 */

const emptyUser: userData = {
  userid: '',
  email: '',
  fullname: '',
  role: '' as UserRole,
  assignedfismasystems: [],
}

/**
 * Loader return shape. Title.tsx and LoginPage.tsx both read this.
 *
 * - `status === 200`: provisioned user, render the dashboard.
 * - `serverError === true`: 5xx / network failure, render ServerErrorPage.
 * - `reason === 'NO_ACCOUNT'`: authenticated identity has no ZTMF account
 *   (or is soft-deleted) - LoginPage renders terminal "contact your
 *   administrator" copy with no retry CTA.
 * - `reason === 'EXPIRED'` (or `ok: false` with no reason): no session or
 *   expired session - LoginPage renders the existing "sign in" affordance.
 */
export type AuthLoaderData = {
  status?: number
  ok?: boolean
  serverError?: boolean
  reason?: SignInReason
  /** BE message body, surfaced verbatim on the NO_ACCOUNT terminal screen. */
  message?: string
  response: userData
}

const authLoader = async (): Promise<AuthLoaderData> => {
  try {
    // skipAuthHandling: the centralized 401-redirect interceptor would
    // hijack this call's 401 with router.navigate('/signin'), which
    // re-runs this loader on the new route and creates an infinite
    // redirect loop. authLoader is the OWNER of the session-expired
    // decision: a 401 here means "render LoginPage as a child route"
    // (via the discriminated return below), not "redirect away."
    const axiosUser = await axiosInstance.get('/users/current', {
      skipAuthHandling: true,
    })
    if (axiosUser.status != 200) {
      return { ok: false, reason: SignInReasons.EXPIRED, response: emptyUser }
    }
    return { status: axiosUser.status, response: axiosUser.data.data }
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number; data?: { code?: string; error?: string } }
      status?: number
    }
    const status = err?.response?.status || err?.status || 0
    if (status >= 500 || status === 0) {
      return { status, serverError: true, response: emptyUser }
    }
    // BE middleware returns 403 with code=ACCOUNT_NOT_PROVISIONED for an
    // authenticated identity that has no ZTMF account or has been soft-
    // deleted. Distinct from a 401 (no/expired session): the IdP session
    // is valid; the user just has no app account. Surface as a terminal
    // state so LoginPage drops the Sign in retry CTA.
    if (
      status === 403 &&
      err?.response?.data?.code === AuthCodes.ACCOUNT_NOT_PROVISIONED
    ) {
      return {
        ok: false,
        reason: SignInReasons.NO_ACCOUNT,
        message: err?.response?.data?.error,
        response: emptyUser,
      }
    }
    if (status === 401) {
      return { ok: false, reason: SignInReasons.EXPIRED, response: emptyUser }
    }
    console.error('Error:', error)
  }
  return { ok: false, reason: SignInReasons.EXPIRED, response: emptyUser }
}

export default authLoader
