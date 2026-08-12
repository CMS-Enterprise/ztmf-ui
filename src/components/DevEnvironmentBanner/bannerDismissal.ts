// Persists the non-production banner's dismissed state, which otherwise resets
// on every fresh document - a new tab, a reload, or signing in (which leaves
// the SPA via window.location).
const DISMISSAL_KEY = 'ztmf_banner_dismissed'

const DEFAULT_VERSION = 'default'

// The copy stamp only re-fires when the wording changes, and impl never sets an
// override - its stamp is permanently DEFAULT_VERSION, so a dismissal there
// would otherwise last forever. The TTL bounds every environment regardless.
const TTL_MS = 7 * 24 * 60 * 60 * 1000

type DismissalRecord = {
  v: string
  t: number
}

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
// make localStorage throw, and a failure just means "not dismissed". A record
// that is unparseable, malformed, or expired is left in place rather than
// cleared, so a bad read can never destroy state - same reasoning as #683.
export function isBannerDismissed(version: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISSAL_KEY)
    if (!raw) return false
    const record = JSON.parse(raw) as DismissalRecord
    if (record?.v !== version || typeof record.t !== 'number') return false
    return Date.now() - record.t < TTL_MS
  } catch {
    return false
  }
}

export function setBannerDismissed(version: string): void {
  try {
    const record: DismissalRecord = { v: version, t: Date.now() }
    localStorage.setItem(DISMISSAL_KEY, JSON.stringify(record))
  } catch {
    // ignore
  }
}
