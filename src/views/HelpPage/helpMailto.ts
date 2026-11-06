/**
 * Builds the Help page's "email the Zero Trust team" link.
 * @module views/HelpPage/helpMailto
 */

// One plain address. Rejecting ?, &, #, %, commas and the like keeps a
// mis-set secret from smuggling extra recipients, headers or a fragment into
// the link (% blocks pre-encoded ones like %3F).
const PLAIN_ADDRESS =
  /^[^\s@?&#%/,;:<>"]+@[^\s@?&#%/,;:<>"]+\.[^\s@?&#%/,;:<>"]+$/

export const HELP_SUBJECT = 'ZTMF help request'

/**
 * Composes the mailto href, or null when the address is unusable.
 * @param {string} email - The configured help address.
 * @param {string} site - The host the user is on, so the team knows the environment.
 * @returns {string | null} The href, or null to hide the button.
 */
export function buildHelpMailto(email: string, site: string): string | null {
  const address = email.trim()
  if (!PLAIN_ADDRESS.test(address)) return null
  const body = `Site: ${site}\nBrowser:\nOperating system:\n\nWhat were you doing when the problem happened?\n`
  return `mailto:${address}?subject=${encodeURIComponent(HELP_SUBJECT)}&body=${encodeURIComponent(body)}`
}
