// Persistence for the non-production banner's dismissed state.
//
// The banner is dismissible, but a plain component state resets on every fresh
// document - a new tab, a reload, and signing in (which leaves the SPA via
// window.location, so it is a full page load). Testers were seeing the banner
// again constantly. localStorage keeps the preference in the browser; it is
// cosmetic UI state, so it never goes to the server.
const DISMISSAL_KEY = 'ztmf_banner_dismissed'

// Sentinel stored when no override copy is configured, so the built-in default
// notice has a stable version of its own.
const DEFAULT_VERSION = 'default'

/**
 * Derives a short stamp identifying the banner copy currently configured.
 *
 * The dismissal record stores this stamp rather than a boolean, so replacing
 * DEV_BANNER_MESSAGE re-surfaces the banner exactly once for everyone who had
 * dismissed the previous notice. Without it, a tester who dismissed an old
 * message would never see a corrected one.
 *
 * FNV-1a, non-cryptographic and used only for versioning - it is not a security
 * control and must not be treated as one. Hashing rather than storing the copy
 * verbatim also keeps the value of a build-time secret off disk, even though
 * the same text is rendered on screen.
 *
 * @param {string} message The configured override copy (may be empty).
 * @returns {string} A stable base36 stamp for that copy.
 */
export function bannerVersion(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return DEFAULT_VERSION
  let hash = 0x811c9dc5
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i)
    // Multiply by the FNV prime (16777619) as shifts, since a plain multiply
    // overflows past 32 bits. >>> 0 keeps the result an unsigned 32-bit int.
    const prime =
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    hash = (hash + prime) >>> 0
  }
  return hash.toString(36)
}

/**
 * Reports whether the banner carrying this copy version was already dismissed.
 * Storage access is guarded because private browsing and disabled site data
 * make localStorage throw; a failure just means "not dismissed", so the banner
 * shows and stays dismissible in-memory.
 *
 * @param {string} version Stamp from bannerVersion for the current copy.
 * @returns {boolean} True when a matching dismissal is on record.
 */
export function isBannerDismissed(version: string): boolean {
  try {
    return localStorage.getItem(DISMISSAL_KEY) === version
  } catch {
    return false
  }
}

/**
 * Records a dismissal of the banner carrying this copy version, overwriting any
 * stamp from earlier copy. Failures are ignored - the dismissal still applies
 * for the life of the page.
 *
 * @param {string} version Stamp from bannerVersion for the current copy.
 * @returns {void}
 */
export function setBannerDismissed(version: string): void {
  try {
    localStorage.setItem(DISMISSAL_KEY, version)
  } catch {
    // ignore
  }
}
