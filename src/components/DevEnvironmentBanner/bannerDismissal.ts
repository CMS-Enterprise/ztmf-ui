// Persists the non-production banner's dismissed state, which otherwise resets
// on every fresh document - a new tab, a reload, or signing in (which leaves
// the SPA via window.location).
const DISMISSAL_KEY = 'ztmf_banner_dismissed'

const DEFAULT_VERSION = 'default'

// The dismissal stores this stamp rather than a boolean, so replacing
// DEV_BANNER_MESSAGE re-surfaces the banner once instead of leaving testers on
// stale wording. FNV-1a: non-cryptographic, versioning only.
export function bannerVersion(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return DEFAULT_VERSION
  let hash = 0x811c9dc5
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i)
    // hash *= 16777619, as shifts because a plain multiply overflows 32 bits.
    const shifted =
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    hash = (hash + shifted) >>> 0
  }
  return hash.toString(36)
}

// Storage access is guarded throughout: private browsing and disabled site data
// make localStorage throw, and a failure just means "not dismissed".
export function isBannerDismissed(version: string): boolean {
  try {
    return localStorage.getItem(DISMISSAL_KEY) === version
  } catch {
    return false
  }
}

export function setBannerDismissed(version: string): void {
  try {
    localStorage.setItem(DISMISSAL_KEY, version)
  } catch {
    // ignore
  }
}
