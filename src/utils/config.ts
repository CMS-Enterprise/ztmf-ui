/**
 * Set global configuration for the application provided by Vite environment variables
 * @module utils/config
 * @exports CONFIG
 */
import type { AppConfig } from '@/types'

const CONFIG = {
  //* Feature flags
  IDP_ENABLED: Boolean(process.env.VITE_IDP_ENABLED),
} satisfies AppConfig

export default CONFIG
