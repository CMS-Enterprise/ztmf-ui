/**
 * Design tokens for the ZTMF UI.
 *
 * This is the single source of truth for color, radius, spacing and type.
 * The MUI theme in theme.ts reads these values so components reference tokens
 * by name instead of hardcoding hex in sx props. Tier colors are intentionally
 * NOT redefined here; they live in utils/tierStyles.ts, which stays the
 * authoritative, 508-reviewed tier palette.
 * @module theme/tokens
 */

/** Brand and UI colors. */
export const colors = {
  // Brand blue ramp.
  primary: '#1B4DAB',
  primaryHover: '#3D6FCB',
  primary50: '#E8EEFA',
  ink900: '#0F2E6E',
  // Near-black used for primary text and dark surfaces.
  ink: '#0E1218',
  // Destructive / danger.
  danger: '#B53F2C',
  dangerHover: '#9B2E1E',
  // Neutral ramp, dark to light.
  neutral900: '#0E1218',
  neutral700: '#39414E',
  neutral500: '#5B6473',
  neutral400: '#9AA3B2',
  neutral200: '#E5E8EE',
  // Faint hairline / row-hover surface, lighter than neutral200.
  neutral100: '#F1F3F7',
  neutral50: '#F7F8FA',
  // Input border and a faint blue-tinted surface used for highlighted rows.
  border: '#C7CCD6',
  surfaceAlt: '#FAFBFE',
  white: '#FFFFFF',
  // Semantic trend / value colors (used for deltas and emphasized counts).
  up: '#0F5C4C', // positive trend, "good" counts
  down: '#A34200', // negative trend, "needs attention" counts
} as const

/**
 * Status pill palettes (background + text), keyed by intent. Mirrors the
 * StatusChip kinds; the leading dot uses currentColor so it inherits text.
 */
export const status = {
  active: { color: '#0F5C4C', bg: '#E8F8F6' },
  neutral: { color: '#5B6473', bg: '#F1F3F7' },
  warning: { color: '#A34200', bg: '#FFF4E6' },
  danger: { color: '#9B2E1E', bg: '#FEE7E3' },
} as const

/**
 * Tier accent dots. Solid, saturated dots that sit next to a score value.
 * These complement the pastel tier chip/cell palettes in utils/tierStyles.ts;
 * the chip and cell backgrounds stay there as the accessible source of truth.
 */
export const tierDot = {
  Optimal: '#0EA371',
  Advanced: '#C19A00',
  Initial: '#D85C00',
  Traditional: '#7B4FB0',
  'Not Assessed': '#9AA3B2',
} as const

/** Corner radii. Pill is reserved for chips and badges only. */
export const radius = {
  sm: 4, // chips, code badges, dense controls
  button: 6, // buttons
  md: 8, // inputs, search fields
  card: 10, // cards, table cards, modals
  lg: 12, // hero panels
  pill: 999, // chips and badges only
} as const

/**
 * Spacing steps in pixels, on a 4px base. The MUI theme already uses
 * spacing: 4, so sx={{ p: 4 }} resolves to 16px; this map is for the rare
 * place that needs a raw pixel value by name.
 */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
} as const

/** Font stacks. Public Sans for UI text, JetBrains Mono for numerics and IDs. */
export const fonts = {
  base: "'Public Sans', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'Cascadia Mono', Menlo, Monaco, Consolas, monospace",
} as const

/** Modal width presets, matched to the design's sm/md/lg/xl contract. */
export const modalWidth = {
  sm: 420,
  md: 560,
  lg: 720,
  xl: 920,
} as const

const tokens = { colors, status, tierDot, radius, space, fonts, modalWidth }
export default tokens
