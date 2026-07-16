// FIPS maturity-baseline logic for the questionnaire (ztmf-ui#547). Pure and
// styling-independent: given an insight payload's `fips_ceiling` / `fips_impact_level`
// and a maturity answer option's score, decide whether the option is "above
// baseline" (warned but still selectable), and produce the badge / strip /
// divider copy. The rendering layer consumes these; the rule lives here so it's
// unit-testable on its own.

export type FipsImpactLevel = 'Low' | 'Moderate' | 'High'

// Shared palette for the FIPS baseline treatment, used by both the strip (in the
// insights panel) and the per-option markers (in the radio group). Gold =
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

// The strip only makes sense when a real impact level is set AND there is
// headroom above the baseline (ceiling < 4) — a High/Optimal system is already
// at the top, so "higher maturity levels are available" would be false.
export function showFipsStrip(
  level: FipsImpactLevel | null | undefined,
  fipsCeiling: number | null | undefined
): boolean {
  // typeof-string (not just != null) so a malformed non-string level from the
  // opaque payload suppresses the strip rather than rendering it badge-less.
  return typeof level === 'string' && baselineCeiling(fipsCeiling) < 4
}

// A system with no FIPS on file arrives with ceiling null/undefined; treat it as
// 4 so nothing scores above it and the UI warns on nothing (never breaks).
export function baselineCeiling(
  fipsCeiling: number | null | undefined
): number {
  return typeof fipsCeiling === 'number' ? fipsCeiling : 4
}

// The core rule: an option is above baseline when its maturity score exceeds the
// system's FIPS ceiling. Score 1 (Traditional) is always the floor, never above.
export function isAboveBaseline(
  score: number,
  fipsCeiling: number | null | undefined
): boolean {
  return score > baselineCeiling(fipsCeiling)
}

// Chrome copy — all gated on a real impact level. A null level (no FIPS on file)
// means no badge/strip/divider at all, so the feature is invisible there.
export function fipsBadgeText(
  level: FipsImpactLevel | null | undefined
): string | null {
  // level rides on an opaque payload; guard against a truthy non-string so
  // `.toUpperCase()` can't throw and blank the whole insights panel.
  return typeof level === 'string' ? `FIPS ${level.toUpperCase()}` : null
}
