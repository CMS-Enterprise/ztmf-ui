import { ReactNode } from 'react'
import TableCell from '@mui/material/TableCell'
import { colors } from '@/theme/tokens'

/** Props for {@link BreakdownHeadCell}. */
export type BreakdownHeadCellProps = {
  /** Header label. */
  children: ReactNode
  /** Optional alignment (typically 'right' for the score column). */
  align?: 'left' | 'right'
  /** Optional sx overrides spread last so callers can pin a width. */
  sx?: object
}

/**
 * Header cell for the question-level breakdown table. Uppercased small-text
 * treatment on a neutral50 background, with a hairline bottom border. Kept
 * here so any future table on the page picks up the same treatment without
 * each call site redefining sx.
 * @param {BreakdownHeadCellProps} props - Component props.
 * @returns {JSX.Element} A styled TableCell suitable for table headers.
 */
export default function BreakdownHeadCell({
  children,
  align,
  sx,
}: BreakdownHeadCellProps) {
  return (
    <TableCell
      align={align}
      sx={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: colors.neutral500,
        backgroundColor: colors.neutral50,
        borderBottom: `1px solid ${colors.neutral200}`,
        ...sx,
      }}
    >
      {children}
    </TableCell>
  )
}
