import {
  OUTLINED_CHIP_AA,
  outlinedChipSx,
  type AccessibleChipColor,
} from '@/utils/chipStyles'

// These colors exist for one reason - to clear WCAG AA against the white a chip
// sits on - so the test computes the ratio rather than restating the hex. A
// future "just nudge the shade" edit that lands back under 4.5:1 fails here
// instead of in a 508 scan.

const WHITE: [number, number, number] = [255, 255, 255]

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

function contrastRatio(hex: string): number {
  const a = relativeLuminance(parseHex(hex))
  const b = relativeLuminance(WHITE)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const colors = Object.keys(OUTLINED_CHIP_AA) as AccessibleChipColor[]

test.each(colors)('%s clears WCAG AA against white', (color) => {
  expect(contrastRatio(OUTLINED_CHIP_AA[color])).toBeGreaterThanOrEqual(4.5)
})

test('the computation agrees with the palette values it replaced', () => {
  // Guards the math itself: MUI's own warning and info mains are the failures
  // that put this file here, and must still read as failures.
  expect(contrastRatio('#ed6c02')).toBeLessThan(4.5)
  expect(contrastRatio('#0288d1')).toBeLessThan(4.5)
  // Outlined success and error pass, which is why they are not in the map.
  expect(contrastRatio('#2e7d32')).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio('#d32f2f')).toBeGreaterThanOrEqual(4.5)
})

test('paints both the label and the border', () => {
  expect(outlinedChipSx('warning')).toEqual({
    color: OUTLINED_CHIP_AA.warning,
    borderColor: OUTLINED_CHIP_AA.warning,
  })
})
