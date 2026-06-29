import type { FismaQuestion } from '@/types'

/**
 * Shape of a pillar group as the Questionnaire page builds it: just the
 * pillar name and the ordered set of question/function steps. Exported
 * so extracted components (PillarRail, SectionRail) can type their props
 * without re-declaring the shape.
 */
export type Category = {
  name: string
  steps: FismaQuestion[]
}

/**
 * Converts a CamelCase or kebab-case input into a lowercase, hyphen-
 * separated slug suitable for URLs. Camel boundaries are split with a
 * dash; whitespace becomes dashes.
 *
 *   "ApplicationsAndWorkloads" -> "applications-and-workloads"
 *   "Cross Cutting"            -> "cross-cutting"
 *
 * @param {string} str - Raw label.
 * @returns {string} The URL slug.
 */
export const toSlug = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll(' ', '-')

/**
 * Inserts spaces before interior capital letters so the navigation labels
 * read as separate words. Used to render function names from their stored
 * CamelCase form ("AppInventory" -> "App Inventory") without changing
 * the underlying value used in URLs.
 * @param {string} str - The CamelCase input.
 * @returns {string} The space-separated label.
 */
export const addSpace = (str: string): string => {
  for (let i = 0; i < str.length; i++) {
    if (i > 0 && str[i] === str[i].toUpperCase() && str[i - 1] !== ' ') {
      str = str.slice(0, i) + ' ' + str.slice(i)
      i++
    }
  }
  return str
}

/**
 * Format a Date as a relative time string ("just now", "2 min ago",
 * "3 hr ago", or a full timestamp for anything older than a day). Used
 * by the SaveIndicator and the page header subtitle so "last saved"
 * reads in the user's expected casual time language.
 * @param {Date} d - The reference time.
 * @returns {string} A human-friendly relative time string.
 */
export function relativeTimeFrom(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (seconds < 30) return 'just now'
  if (seconds < 90) return '1 min ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
