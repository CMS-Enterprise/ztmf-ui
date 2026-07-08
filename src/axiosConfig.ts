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
  baseURL: '/api/v1/',
  headers: {
    'Content-Type': 'application/json',
  },
  // Same-origin requests to /api/v1/ already carry cookies, so this has no
  // effect while the API shares the app's origin. It is set explicitly so
  // credentialed requests keep working if the API is served from a
  // separate origin.
  withCredentials: true,
})

// Local development only: bypass auth with token from .env
// This will NOT run in AWS dev/prod builds - only when running `yarn dev` locally
if (import.meta.env.VITE_LOCAL_DEV === 'true') {
  axiosInstance.defaults.headers.common['Authorization'] =
    `Bearer ${import.meta.env.VITE_AUTH_TOKEN3 || ''}`
}

/** Register a response interceptor on the instance. axios calls the
 * first argument on every successful response and the second on every
 * error. The success path passes through untouched; the error path
 * delegates to handleAuthError, which centralizes 401/403 handling so
 * views do not repeat the same redirect/snackbar ladder in every catch.
 */
axiosInstance.interceptors.response.use((response) => response, handleAuthError)

export default axiosInstance
