/**
 * Set global configuration for the application provided by Vite environment variables
 * @module utils/config
 * @exports CONFIG
 */
import type { AppConfig } from '@/types'

const CONFIG = {
  //* Feature flags
  IDP_ENABLED: String(import.meta.env.VITE_IDP_ENABLED) === 'true',
  // ZTMF Insights "How to fix" remediation. Set true only on the impl build
  // (VITE_INSIGHTS_SUGGEST_FIX_ENABLED in ui.yml); unset elsewhere → false.
  INSIGHTS_SUGGEST_FIX_ENABLED:
    String(import.meta.env.VITE_INSIGHTS_SUGGEST_FIX_ENABLED) === 'true',

  //* Environment
  // Vite's build mode is 'production' only for `yarn build:prod`; local dev,
  // AWS dev, and impl all resolve to non-production modes.
  IS_NONPROD: import.meta.env.MODE !== 'production',

  //* Development banner overrides (blank in the repo by design)
  // Set only on the deployed dev build during a testing window, then cleared.
  // Empty values fall back to the banner's built-in default copy / hide links.
  DEV_BANNER_MESSAGE: import.meta.env.VITE_DEV_BANNER_MESSAGE ?? '',
  DEV_FEEDBACK_URL: import.meta.env.VITE_DEV_FEEDBACK_URL ?? '',
  DEV_CONTACT_EMAIL: import.meta.env.VITE_DEV_CONTACT_EMAIL ?? '',
} satisfies AppConfig

export default CONFIG
