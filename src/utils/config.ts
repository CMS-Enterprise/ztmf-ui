/**
 * Set global configuration for the application provided by Vite environment variables
 * @module utils/config
 * @exports CONFIG
 */
import type { AppConfig } from '@/types'

const CONFIG = {
  //* Feature flags
  IDP_ENABLED: String(import.meta.env.VITE_IDP_ENABLED) === 'true',
} satisfies AppConfig

export default CONFIG
