import {
  isAboveBaseline,
  baselineCeiling,
  fipsBadgeText,
  resolveFipsBaseline,
  asImpactLevel,
} from './fipsBaseline'

describe('fipsBaseline', () => {
  describe('isAboveBaseline', () => {
    it('warns on options scoring above the ceiling, not at/below it (Low → ceiling 2)', () => {
      expect(isAboveBaseline(1, 2)).toBe(false) // Traditional - floor
      expect(isAboveBaseline(2, 2)).toBe(false) // at baseline
      expect(isAboveBaseline(3, 2)).toBe(true) // Advanced - above
      expect(isAboveBaseline(4, 2)).toBe(true) // Optimal - above
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
      // option; clamp it - and anything outside 1–4 - back to the safe ceiling.
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
  })

  describe('resolveFipsBaseline (ztmf-ui#764)', () => {
    it('reads the system record: Low → 2, Moderate → 3', () => {
      expect(
        resolveFipsBaseline({ fips: 'Low', hva: false }, undefined)
      ).toEqual({ level: 'Low', ceiling: 2 })
      expect(resolveFipsBaseline({ fips: 'Moderate' }, undefined)).toEqual({
        level: 'Moderate',
        ceiling: 3,
      })
    })

    it('is null for High, for an HVA, and with no FIPS anywhere', () => {
      expect(resolveFipsBaseline({ fips: 'High' }, undefined)).toBeNull()
      expect(
        resolveFipsBaseline({ fips: 'Low', hva: true }, undefined)
      ).toBeNull()
      // HVA wins even when the record has no FIPS and the payload has one.
      expect(
        resolveFipsBaseline(
          { fips: null, hva: true },
          { fips_impact_level: 'Low', fips_ceiling: 2 }
        )
      ).toBeNull()
      expect(
        resolveFipsBaseline({ fips: null, hva: null }, undefined)
      ).toBeNull()
      expect(resolveFipsBaseline(undefined, undefined)).toBeNull()
    })

    it('prefers the system record over the insight payload', () => {
      expect(
        resolveFipsBaseline(
          { fips: 'Moderate' },
          { fips_impact_level: 'Low', fips_ceiling: 2 }
        )
      ).toEqual({ level: 'Moderate', ceiling: 3 })
      expect(
        resolveFipsBaseline(
          { fips: 'High' },
          { fips_impact_level: 'Low', fips_ceiling: 2 }
        )
      ).toBeNull()
    })

    it('falls back to the insight payload when the record has no (or a malformed) FIPS', () => {
      const insight = { fips_impact_level: 'Low', fips_ceiling: 2 }
      expect(resolveFipsBaseline({ fips: null }, insight)).toEqual({
        level: 'Low',
        ceiling: 2,
      })
      expect(resolveFipsBaseline({ fips: 'low' }, insight)).toEqual({
        level: 'Low',
        ceiling: 2,
      })
    })

    it('ignores a malformed insight payload', () => {
      expect(
        resolveFipsBaseline(undefined, {
          fips_impact_level: 3,
          fips_ceiling: 2,
        })
      ).toBeNull()
      expect(
        resolveFipsBaseline(undefined, {
          fips_impact_level: 'Low',
          fips_ceiling: 0,
        })
      ).toBeNull()
    })
  })
})
