import {
  isAboveBaseline,
  baselineCeiling,
  fipsBadgeText,
  showFipsStrip,
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
