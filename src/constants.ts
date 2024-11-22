/**
 * Application-wide constants
 * @module constants
 */

//* Application Strings
export const ORG_NAME = 'CMS'
export const ORG_URL = 'https://www.cms.gov'
export const COPYRIGHT_LABEL = `Copyright © ${new Date()
  .getFullYear()
  .toString()}`

// * Configuration Constants
export const DEFAULT_ALERT_TIMEOUT = 3000

export const ERROR_MESSAGES = {
  login: 'Please log in to continue.',
  expired: 'Your session has expired. Please log in again.',
  notSaved:
    'Your changes were not saved. Your session may have expired. Please log in again.',
  error:
    'An error occurred. Please log in and try again. If the error persists, please contact support.',
}
