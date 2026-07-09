// Target-maturity vocabulary shared by the card and the page save flow
// (ztmf#398). Mirrors the backend's validTargetMaturityTiers: the tier NAME is
// the stored value; the CISA stage number is display-only. Traditional (1) is
// deliberately not offered.
export const TIER_OPTIONS = [
  { value: 'Initial', label: '2 — Initial' },
  { value: 'Advanced', label: '3 — Advanced (default)' },
  { value: 'Optimal', label: '4 — Optimal' },
]

export const DEFAULT_TARGET_TIER = 'Advanced'
export const TARGET_JUSTIFICATION_MAX = 1000
