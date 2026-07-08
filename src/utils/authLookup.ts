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
 * Discriminated result of the pre-auth lookup.
 *
 * - `{ idp }` - the backend answered cleanly. `idp` is `'okta'`/`'entra'`
 *   for a routed identity, or `null` for the deliberate non-enumeration
 *   "no IdP" response (unknown / unprovisioned / soft-deleted - all
 *   indistinguishable by contract).
 * - `{ unavailable: true }` - a transport or server failure (timeout,
 *   network error, 4xx/5xx, or a 2xx whose body did not carry a known
 *   `idp` marker). This is the ONLY state the landing page may surface
 *   distinctly; it is independent of whether the email maps to an
 *   account, so it carries no enumeration signal.
 */
export type LookupResult = { idp: IdpRouting } | { unavailable: true }

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
 * @returns A {@link LookupResult}: `{ idp }` for a clean backend answer
 *   (including the non-enumeration `null`), or `{ unavailable: true }`
 *   when the call failed at the transport/server level. The two are kept
 *   separate so the landing page can offer a retry on an outage without
 *   ever revealing whether an email maps to an account.
 */
export async function lookupIdpForEmail(email: string): Promise<LookupResult> {
  try {
    const response = await axiosInstance.get<LookupResponse>('/auth/lookup', {
      params: { email },
      timeout: LOOKUP_TIMEOUT_MS,
      // The lookup is unauthenticated; the interceptor's 401/403 redirect
      // would be wrong here. Caller owns the failure handling below.
      skipAuthHandling: true,
    })
    const idp = response.data?.data?.idp
    // Only accept the known markers. A 2xx whose body is not one of these
    // (missing field, unexpected value) is a malformed response, not a
    // genuine "no IdP" - treat it as unavailable so it is never conflated
    // with the deliberate null.
    if (idp === 'okta' || idp === 'entra' || idp === null) {
      return { idp }
    }
    return { unavailable: true }
  } catch {
    // Timeout (ECONNABORTED), network error, 4xx, 5xx. Distinct from the
    // 200 {idp:null} handled above: a transport/server failure is the one
    // state the landing page may surface separately (a retry prompt),
    // because it does not depend on whether the email exists.
    return { unavailable: true }
  }
}
