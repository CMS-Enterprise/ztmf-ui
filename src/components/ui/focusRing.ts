import { colors } from '@/theme/tokens'

/**
 * The app's keyboard focus ring, for a wrapper whose inner control takes focus
 * (a toolbar search box's bare InputBase). Spread into the wrapper's sx.
 */
export const focusWithinRing = {
  '&:focus-within': {
    outline: `2px solid ${colors.primary}`,
    outlineOffset: -1,
  },
} as const
