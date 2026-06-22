import axiosInstance from '@/axiosConfig'

/**
 * Identity provider routing values returned by the pre-auth lookup endpoint.
 * `null` is the deliberate non-enumeration response for both unknown and
 * unprovisioned emails - the same response shape is returned for both to
 * avoid leaking which emails exist on the backend side.
 */
export type IdpRouting = 'okta' | 'entra' | null

/**
 * Response shape for GET /api/v1/auth/lookup. The envelope mirrors the
 * project's other read endpoints: payload under `data`.
 */
type LookupResponse = {
  data: { idp: IdpRouting }
}

/**
 * 5-second cap on the unauthenticated lookup call so the Continue button
 * does not hang indefinitely if the endpoint is slow or unreachable. The
 * landing page treats a timeout the same as any other failure: show the
 * generic "Contact your administrator" message, no enumeration signal.
 */
const LOOKUP_TIMEOUT_MS = 5000

/**
 * Pre-auth lookup that maps an email to its identity provider so the
 * landing page can route the user to the matching /login/<idp> path.
 *
 * The endpoint is unauthenticated and rate-limited on the backend, and is
 * forwarded by a dedicated ALB rule (no OIDC challenge). On the FE side
 * the only state-bearing decision is the timeout: 5 seconds is enough for
 * a healthy backend and short enough that a stuck call falls back to the
 * generic error path quickly.
 *
 * Local dev hits the same endpoint via the Vite proxy (vite.config.ts
 * forwards /api/v1 to VITE_CF_DOMAIN which points at the local backend on
 * localhost:8080 when `make dev-up` is running). No FE-side mock; the
 * backend's controller.LookupIdP is the single source of truth even in
 * local dev.
 *
 * @param email - The email entered on the landing page. Not validated
 *   here; the caller is expected to gate on format before calling.
 * @returns The resolved IdP marker, or null when the email is not
 *   provisioned (deliberately indistinguishable from "unknown email" per
 *   the non-enumeration contract).
 */
export async function lookupIdpForEmail(email: string): Promise<IdpRouting> {
  try {
    const response = await axiosInstance.get<LookupResponse>('/auth/lookup', {
      params: { email },
      timeout: LOOKUP_TIMEOUT_MS,
      // The lookup is unauthenticated; the interceptor's 401/403 redirect
      // would be wrong here. Caller treats any failure as a null result.
      skipAuthHandling: true,
    })
    return response.data.data.idp
  } catch {
    // Timeout, network error, 4xx, 5xx all collapse to null. The landing
    // page renders the same generic message either way; that is the
    // non-enumeration contract.
    return null
  }
}
