// An outlined MUI chip paints its label with `<color>.main`, and the default
// palette tunes those for fills, not for text on white: warning holds 3.11:1
// and info 3.86:1, both under the WCAG AA 4.5:1 floor for text. Each entry
// keeps its hue and darkens until it clears AA, with the border following so
// the chip stays one color (ui#714).
//
// Only the colors that fail are listed. Outlined success (#2e7d32, 5.13:1) and
// error (#d32f2f, 4.98:1) already pass and are left to the palette; adding them
// here would freeze values that are fine as they are.
const OUTLINED_CHIP_AA = {
  warning: '#BE5702', // 4.61:1 on white
  info: '#027ABC', // 4.65:1 on white
} as const

export type AccessibleChipColor = keyof typeof OUTLINED_CHIP_AA

/**
 * `sx` for an outlined chip whose palette color is too light to read as text.
 * @param {AccessibleChipColor} color - The chip's MUI color.
 * @returns {object} sx overriding the label and border color.
 */
export const outlinedChipSx = (color: AccessibleChipColor) => ({
  color: OUTLINED_CHIP_AA[color],
  borderColor: OUTLINED_CHIP_AA[color],
})

export { OUTLINED_CHIP_AA }
