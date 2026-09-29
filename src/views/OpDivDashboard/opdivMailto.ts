/**
 * Builds the OpDiv-scoped email compose link.
 *
 * A mailto rather than the app's mass-email endpoint: that endpoint takes a
 * global recipient group with no per-OpDiv scoping and rejects OpDiv-scoped
 * admins by design, so it cannot express "email this OpDiv's contacts". The
 * addresses are already on the client, so composing locally is both correctly
 * scoped and available to every tier that can see the page.
 *
 * @module views/OpDivDashboard/opdivMailto
 */
import type { FismaSystemType } from '@/types'

/**
 * Practical ceiling for a mailto URL. Browsers and mail clients truncate long
 * ones silently, which would drop recipients without telling anyone - so past
 * this the link carries a subject only and the caller offers the full list to
 * copy instead.
 */
export const MAILTO_MAX_LENGTH = 1500

/** A composed mail link plus what it actually covers. */
export type OpDivMailto = {
  href: string
  /** Distinct addresses found. */
  count: number
  /** Every address, for a copy-to-clipboard fallback. */
  addresses: string[]
  /** True when the address list did not fit and was left out of the link. */
  truncated: boolean
}

/**
 * Collects an OpDiv's contactable addresses and composes a mailto link.
 *
 * Recipients go in bcc: a data-call nudge to dozens of ISSOs should not
 * disclose the full contact list to all of them.
 * @param {FismaSystemType[]} systems - The OpDiv's systems.
 * @param {string} opdivCode - Used in the subject line.
 * @returns {OpDivMailto} The link, the count and the raw addresses.
 */
export function buildOpDivMailto(
  systems: FismaSystemType[],
  opdivCode: string
): OpDivMailto {
  const seen = new Set<string>()
  for (const system of systems) {
    for (const raw of [system.issoemail, system.datacallcontact]) {
      const address = raw?.trim()
      if (!address) continue
      // Case-insensitive dedupe: the same person is often recorded with
      // different capitalization across systems.
      const key = address.toLowerCase()
      if (!seen.has(key)) seen.add(key)
    }
  }

  const addresses = [...seen].sort()
  const subject = encodeURIComponent(`${opdivCode} Zero Trust data call`)
  const withRecipients = `mailto:?bcc=${encodeURIComponent(addresses.join(','))}&subject=${subject}`
  const truncated = withRecipients.length > MAILTO_MAX_LENGTH

  return {
    href: truncated ? `mailto:?subject=${subject}` : withRecipients,
    count: addresses.length,
    addresses,
    truncated,
  }
}
