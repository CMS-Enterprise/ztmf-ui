import { colors } from '@/theme/tokens'

/**
 * sx for the body cells of the question-level breakdown table. Kept in its
 * own file (separate from BreakdownHeadCell.tsx) so React Fast Refresh can
 * still hot-reload the component file - co-exporting non-component values
 * from a component module breaks the refresh boundary.
 */
export const breakdownCellSx = {
  borderBottom: `1px solid ${colors.neutral200}`,
  py: 1.25,
}
