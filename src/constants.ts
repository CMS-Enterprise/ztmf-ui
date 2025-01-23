/**
 * Application-wide constants
 * @module constants
 */
import { userData } from './types'

//* Application Strings
export const ORG_NAME = 'CMS'
export const ORG_URL = 'https://www.cms.gov'
export const COPYRIGHT_LABEL = `Copyright © ${new Date()
  .getFullYear()
  .toString()}`

// * Configuration Constants
export const DEFAULT_ALERT_TIMEOUT = 3000

export const ROLES = ['ISSO', 'ISSM', 'ADMIN']

export const ERROR_MESSAGES = {
  login: 'Please log in to continue.',
  expired: 'Your session has expired. Please log in again.',
  notSaved:
    'Your changes were not saved. Your session may have expired. Please log in again.',
  error:
    'An error occurred. Please log in and try again. If the error persists, please contact support.',
}
export const EMPTY_USER: userData = {
  userid: '',
  email: '',
  fullname: '',
  role: '',
  assignedfismasystems: [],
}
export const CONFIRMATION_MESSAGE =
  'Your changes will not be saved! Are you sure you want to close out of editing a Fisma system before saving your changes?'

export const PILLAR_FUNCTION_MAP: { [key: string]: string[] } = {
  Identity: [
    'AccessManagement',
    'Identity-AutomationOrchestration',
    'Identity-Governance',
    'IdentityStores-Users',
    'RiskAssessment',
    'Authentication-Users',
    'Identity-VisibilityAnalytics',
  ],
  Devices: [
    'AssetRiskManagement',
    'Device-AutomationOrchestration',
    'Device-Governance',
    'DeviceThreatProtection',
    'PolicyEnforcement',
    'Device-VisibilityAnalytics',
    'ResourceAccess',
  ],
  Networks: [
    'Network-AutomationOrchestration',
    'Network-Encryption',
    'Network-Governance',
    'NetworkResilience',
    'NetworkSegmentation',
    'NetworkTrafficManagement',
    'Network-VisibilityAnalytics',
  ],
  Applications: [
    'AccessibleApplications',
    'AccessAuthorization-Users',
    'Application-AutomationOrchestration',
    'Application-Governance',
    'SecureDevDeployWorkflow',
    'ApplicationSecurityTesting',
    'AppThreatProtection',
    'Application-VisibilityAnalytics',
  ],
  Data: [
    'DataAccess',
    'Data-AutomationOrchestration',
    'DataAvailability',
    'DataCategorization',
    'DataEncryption',
    'Data-Governance',
    'DataInventoryManagement',
    'Data-VisibilityAnalytics',
  ],
  CrossCutting: [
    'Cross-AutomationOrchestration',
    'Cross-Governance',
    'Cross-VisibilityAnalytics',
  ],
}
export const TEXTFIELD_HELPER_TEXT = 'This field is required'

export const INVALID_INPUT_TEXT = (key: string) =>
  `Please provide a valid ${key}`
