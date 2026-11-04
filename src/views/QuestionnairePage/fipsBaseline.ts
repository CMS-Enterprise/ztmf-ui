// FIPS maturity-baseline logic for the questionnaire (ztmf-ui#547). Pure and
// styling-independent: given a system's FIPS ceiling and impact level and a
// maturity answer option's score, decide whether the option is "above
// baseline" (warned but still selectable), and produce the badge / strip /
// divider copy. The rendering layer consumes these; the rule lives here so it's
// unit-testable on its own.

export type FipsImpactLevel = 'Low' | 'Moderate' | 'High'

const IMPACT_LEVELS: readonly FipsImpactLevel[] = ['Low', 'Moderate', 'High']

// `fips_impact_level` rides on the opaque payload, so a TS `as` cast buys
// nothing at runtime. Narrow it to one of the three literals (or null) here so
// every surface - the strip and the per-option markers - reads it the same way
// and suppresses together on a malformed value, rather than interpolating a
// number into "▲ above 3 baseline".
export function asImpactLevel(x: unknown): FipsImpactLevel | null {
  return typeof x === 'string' &&
    (IMPACT_LEVELS as readonly string[]).includes(x)
    ? (x as FipsImpactLevel)
    : null
}

// Shared palette for the FIPS baseline treatment, used by both the strip and the
// per-option markers (in the radio group). Gold =
// "above your baseline" (attention, optional); the dotted blue baseline box =
// "where you should be". All text/background pairs clear WCAG AA (>= 4.5:1).
export const FIPS_GOLD = {
  box: '#fffdf5',
  border: '#e8d87a',
  text: '#6b5700',
  strong: '#4a3c00',
  badgeBg: '#f5e642',
  badgeText: '#5a4a00',
  dividerLine: '#c9a800',
  dividerLabel: '#8b6e00',
}

export const FIPS_BASELINE = {
  box: '#fafaff',
  border: '#8b93cc',
  badgeBg: '#eef0fb',
  badgeText: '#3a4a8f',
}

export type FipsBaseline = { level: FipsImpactLevel; ceiling: number }

// FIPS 199 impact level -> highest expected maturity (misc#137). An HVA is held
// to Optimal regardless of its FIPS level.
const CEILING_BY_LEVEL: Record<FipsImpactLevel, number> = {
  Low: 2,
  Moderate: 3,
  High: 4,
}

// The one source for both the strip and the per-option markers (ztmf-ui#764).
// The system record's own fips/hva wins; the Insights payload is only a fallback
// for a record with no FIPS, since only Insights-enabled OpDivs get a payload.
// Null when there is no level or no headroom above the baseline (ceiling 4): a
// High/HVA system is already at the top, so there is nothing to mark.
export function resolveFipsBaseline(
  system: { fips?: string | null; hva?: boolean | null } | null | undefined,
  insight:
    | { fips_impact_level?: unknown; fips_ceiling?: number | null }
    | null
    | undefined
): FipsBaseline | null {
  if (system?.hva === true) return null
  const systemLevel = asImpactLevel(system?.fips)
  let level: FipsImpactLevel | null
  let ceiling: number
  if (systemLevel) {
    level = systemLevel
    ceiling = CEILING_BY_LEVEL[systemLevel]
  } else {
    level = asImpactLevel(insight?.fips_impact_level)
    ceiling = baselineCeiling(insight?.fips_ceiling)
  }
  return level && ceiling < 4 ? { level, ceiling } : null
}

// A system with no FIPS on file arrives with ceiling null/undefined; treat it as
// 4 so nothing scores above it and the UI warns on nothing (never breaks).
// Clamp to the valid 1–4 maturity range too: a stray 0 (a zero serialized in
// place of null) would make `score > ceiling` true for every option - the exact
// inverse of the fail-safe - so any out-of-range number also falls back to 4.
export function baselineCeiling(
  fipsCeiling: number | null | undefined
): number {
  return typeof fipsCeiling === 'number' && fipsCeiling >= 1 && fipsCeiling <= 4
    ? fipsCeiling
    : 4
}

// The core rule: an option is above baseline when its maturity score exceeds the
// system's FIPS ceiling. Score 1 (Traditional) is always the floor, never above.
export function isAboveBaseline(
  score: number,
  fipsCeiling: number | null | undefined
): boolean {
  return score > baselineCeiling(fipsCeiling)
}

// Chrome copy - all gated on a real impact level. A null level (no FIPS on file)
// means no badge/strip/divider at all, so the feature is invisible there.
export function fipsBadgeText(
  level: FipsImpactLevel | null | undefined
): string | null {
  // level rides on an opaque payload; guard against a truthy non-string so
  // `.toUpperCase()` can't throw and blank the whole insights panel.
  return typeof level === 'string' ? `FIPS ${level.toUpperCase()}` : null
}
