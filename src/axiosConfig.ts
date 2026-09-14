import axios, { AxiosInstance } from 'axios'
import { handleAuthError } from '@/utils/authInterceptor'

/** Module augmentation note: extends axios's built-in AxiosRequestConfig type
 * so callers can pass `skipAuthHandling: true` on a per-request basis
 * and TypeScript accepts it as a valid option without a cast. The
 * interceptor reads this field off `error.config` to decide whether to
 * run its 401/403 handling. Without the augmentation, every caller that
 * wanted to opt out would have to cast the config object, and the
 * TypeScript build would not catch typos in the field name.
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Set to true on a specific request to opt out of the interceptor's
     * 401-redirect / 403-snackbar behavior. Callers that render auth
     * failures inline (e.g. "no record" empty state for a 403) own the
     * handling themselves.
     */
    skipAuthHandling?: boolean
  }
}

const axiosInstance: AxiosInstance = axios.create({
  // Relative on purpose: the browser resolves it against the document URL,
  // so the same bundle calls /api/v1/ when served at "/" and
  // /pr/<repo>/<n>/api/v1/ when served under a PR-environment prefix
  // (ztmf-misc#351). The hash router never changes the document path, so
  // resolution is stable on every route.
  baseURL: 'api/v1/',
  headers: {
    'Content-Type': 'application/json',
  },
  // Same-origin requests to api/v1/ already carry cookies, so this has no
  // effect while the API shares the app's origin. It is set explicitly so
  // credentialed requests keep working if the API is served from a
  // separate origin.
  withCredentials: true,
})

// Auth-bypass token for environments without OIDC (local dev, PR
// environments). Read at runtime from config.js, a classic script loaded in
// index.html before the module graph, so a prebuilt image can carry a
// per-environment token without a rebuild. Locally `make frontend-env`
// generates public/config.js; deployed dev/prod serve an empty stub, so no
// token is present there and cookie auth applies as before.
const runtimeToken = window.ZTMF_RUNTIME_CONFIG?.authToken
if (runtimeToken) {
  axiosInstance.defaults.headers.common['Authorization'] =
    `Bearer ${runtimeToken}`
}

/** Register a response interceptor on the instance. axios calls the
 * first argument on every successful response and the second on every
 * error. The success path passes through untouched; the error path
 * delegates to handleAuthError, which centralizes 401/403 handling so
 * views do not repeat the same redirect/snackbar ladder in every catch.
 */
axiosInstance.interceptors.response.use((response) => response, handleAuthError)

export default axiosInstance
