import {
  isAboveBaseline,
  baselineCeiling,
  fipsBadgeText,
  showFipsStrip,
  asImpactLevel,
} from './fipsBaseline'

describe('fipsBaseline', () => {
  describe('isAboveBaseline', () => {
    it('warns on options scoring above the ceiling, not at/below it (Low → ceiling 2)', () => {
      expect(isAboveBaseline(1, 2)).toBe(false) // Traditional — floor
      expect(isAboveBaseline(2, 2)).toBe(false) // at baseline
      expect(isAboveBaseline(3, 2)).toBe(true) // Advanced — above
      expect(isAboveBaseline(4, 2)).toBe(true) // Optimal — above
    })

    it('Moderate (ceiling 3) warns only on Optimal', () => {
      expect(isAboveBaseline(3, 3)).toBe(false)
      expect(isAboveBaseline(4, 3)).toBe(true)
    })

    it('High (ceiling 4) warns on nothing', () => {
      expect([1, 2, 3, 4].some((s) => isAboveBaseline(s, 4))).toBe(false)
    })

    it('null/undefined ceiling (no FIPS on file) falls back to 4 → warns on nothing', () => {
      expect(isAboveBaseline(4, null)).toBe(false)
      expect(isAboveBaseline(4, undefined)).toBe(false)
      expect(baselineCeiling(null)).toBe(4)
    })

    it('out-of-range ceiling falls back to 4 (a stray 0 must not invert the fail-safe)', () => {
      // 0 serialized in place of null would make score > ceiling true for every
      // option; clamp it — and anything outside 1–4 — back to the safe ceiling.
      expect(baselineCeiling(0)).toBe(4)
      expect(baselineCeiling(-1)).toBe(4)
      expect(baselineCeiling(5)).toBe(4)
      expect(baselineCeiling(NaN)).toBe(4)
      expect(isAboveBaseline(1, 0)).toBe(false) // floor stays the floor
      // valid range still passes through untouched
      expect(baselineCeiling(1)).toBe(1)
      expect(baselineCeiling(4)).toBe(4)
    })
  })

  describe('asImpactLevel', () => {
    it('narrows the three valid literals, nulls everything else', () => {
      expect(asImpactLevel('Low')).toBe('Low')
      expect(asImpactLevel('Moderate')).toBe('Moderate')
      expect(asImpactLevel('High')).toBe('High')
      // malformed values from the opaque payload → null (feature stays invisible)
      expect(asImpactLevel(null)).toBeNull()
      expect(asImpactLevel(undefined)).toBeNull()
      expect(asImpactLevel(3)).toBeNull()
      expect(asImpactLevel('low')).toBeNull() // case-sensitive
      expect(asImpactLevel({})).toBeNull()
    })
  })

  describe('text bindings', () => {
    it('badge is "FIPS <LEVEL>", or null with no level', () => {
      expect(fipsBadgeText('Low')).toBe('FIPS LOW')
      expect(fipsBadgeText('Moderate')).toBe('FIPS MODERATE')
      expect(fipsBadgeText(null)).toBeNull()
    })

    it('badge is null (never throws) on a non-string level from the opaque payload', () => {
      expect(fipsBadgeText(3 as unknown as null)).toBeNull()
      expect(fipsBadgeText({} as unknown as null)).toBeNull()
    })

    it('showFipsStrip only when a level is set and there is headroom (ceiling < 4)', () => {
      expect(showFipsStrip('Low', 2)).toBe(true)
      expect(showFipsStrip('Moderate', 3)).toBe(true)
      expect(showFipsStrip('High', 4)).toBe(false) // already at the top
      expect(showFipsStrip(null, 2)).toBe(false) // no impact level
      expect(showFipsStrip(null, null)).toBe(false) // no FIPS on file
    })
  })
})
