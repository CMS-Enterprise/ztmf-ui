/**
 * Application-wide constants
 * @module constants
 */
import { userData, UserRole } from './types'

//* Application Strings
export const ORG_NAME = 'CMS'
export const ORG_URL = 'https://www.cms.gov'
export const COPYRIGHT_LABEL = `Copyright © ${new Date()
  .getFullYear()
  .toString()}`

// * Configuration Constants
export const DEFAULT_ALERT_TIMEOUT = 3000

export const ROLES = ['ISSO', 'ISSM', 'ADMIN', 'READONLY_ADMIN']

export const ERROR_MESSAGES = {
  login: 'Please log in to continue.',
  expired: 'Your session has expired. Please log in again.',
  notSaved:
    'Your changes were not saved. Your session may have expired. Please log in again.',
  error:
    'An error occurred. Please log in and try again. If the error persists, please contact support.',
  permission: 'You do not have permission to do this action.',
  tryAgain: 'An error occurred, please try again later',
  refresh:
    'Could not refresh the latest data. The information shown may be out of date.',
  systemNotFound: 'System not found',
}

// Short UI status strings for snackbar toasts on save/create flows. Distinct
// from ERROR_MESSAGES because these are not errors — they are user-facing
// status indicators returned by the operation. Keeping them grouped avoids
// the naming collision with ERROR_MESSAGES.notSaved (which is the long-form
// session-expired warning).
export const STATUS_MESSAGES = {
  saved: 'Saved',
  notSaved: 'Not Saved',
  created: 'Created',
  notCreated: 'Not Created',
  systemDecommissioned: 'System decommissioned successfully',
  systemReactivated: 'System reactivated successfully',
}
export const EMPTY_USER: userData = {
  userid: '',
  email: '',
  fullname: '',
  role: '' as UserRole,
  assignedfismasystems: [],
}
export const CONFIRMATION_MESSAGE =
  'Your changes will not be saved! Are you sure you want to close out of editing a Fisma system before saving your changes?'

export const CONFIRMATION_MESSAGE_QUESTION =
  'Your changes will not be saved! Are you sure you want to leave question without saving your changes?'

export const NOTES_UPDATE_REQUIRED_MSG =
  'Please update your notes to reflect the changed answer.'

/**
 * Pillars hidden on the questionnaire for SaaS systems. Names must match the API's
 * `question.pillar.pillar` value exactly.
 */
export const SAAS_EXCLUDED_PILLARS = ['Devices', 'Applications'] as const

// If we wanted to filter out some pillars for other environments, we could add them here.
// For now, only SaaS triggers any filtering.

// ---------

/**
 * The fixed order for pillars on the questionnaire, no matter what order the
 * API returns them in. Each name has to match the API's
 * `question.pillar.pillar` value exactly (same keys as {@link PILLAR_FUNCTION_MAP}).
 */
export const PILLAR_ORDER: string[] = [
  'Identity',
  'Devices',
  'Networks',
  'Applications',
  'Data',
  'CrossCutting',
]
export const PILLAR_FUNCTION_MAP: { [key: string]: string[] } = {
  Identity: [
    'Authentication-Users',
    'IdentityStores-Users',
    'RiskAssessment',
    'AccessManagement',
    'Identity-VisibilityAnalytics',
    'Identity-AutomationOrchestration',
    'Identity-Governance',
  ],
  Devices: [
    'PolicyEnforcement',
    'AssetRiskManagement',
    'ResourceAccess',
    'Device-ThreatProtection',
    'Device-VisibilityAnalytics',
    'Device-AutomationOrchestration',
    'Device-Governance',
  ],
  Networks: [
    'NetworkSegmentation',
    'NetworkTrafficManagement',
    'Network-Encryption',
    'NetworkResilience',
    'Network-VisibilityAnalytics',
    'Network-AutomationOrchestration',
    'Network-Governance',
  ],
  Applications: [
    'AccessAuthorization-Users',
    'Application-ThreatProtection',
    'AccessibleApplications',
    'SecureDevDeployWorkflow',
    'Application-SecurityTesting',
    'Application-VisibilityAnalytics',
    'Application-AutomationOrchestration',
    'Application-Governance',
  ],
  Data: [
    'DataInventoryManagement',
    'DataCategorization',
    'DataAvailability',
    'DataAccess',
    'DataEncryption',
    'Data-VisibilityAnalytics',
    'Data-AutomationOrchestration',
    'Data-Governance',
  ],
  CrossCutting: [
    'Cross-VisibilityAnalytics',
    'Cross-AutomationOrchestration',
    'Cross-Governance',
  ],
}
export const SDL_SYNC_DESCRIPTION_ON =
  'This system and its scores will be exported to the CMS data lake.'
export const SDL_SYNC_DESCRIPTION_OFF =
  'This system is excluded from CMS data lake exports.'

export const SDL_SYNC_SWITCH_SX = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: '#004297' },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: '#004297',
  },
} as const

export const MAX_QUESTIONNAIRE_NOTES_LENGTH = 2000

export const TEXTFIELD_HELPER_TEXT = 'This field is required'

export const INVALID_INPUT_TEXT = (key: string) =>
  `Please provide a valid ${key}`

export const EXTENDED_METADATA_TITLE = 'Extended Metadata'
export const EXTENDED_METADATA_SUBHEADER =
  'Populated by the onboarding data load'
export const EXTENDED_METADATA_LOCK_TOOLTIP =
  'Extended metadata is populated by the onboarding data load; only organization-wide admins can edit these fields.'
export const EXTENDED_METADATA_CREATE_HINT =
  'Populated by the onboarding data load. Set these only when you already have the information; otherwise leave blank and the load will fill them in.'
export const EXTENDED_METADATA_EDIT_HINT =
  'Populated by the onboarding data load. Edit only to correct a value.'
