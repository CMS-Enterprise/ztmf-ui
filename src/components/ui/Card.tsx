import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import { colors, radius } from '@/theme/tokens'

/** Props for {@link Card}. */
export type CardProps = {
  /** Card body. */
  children: ReactNode
  /** Optional sx overrides spread onto the outer wrapper. */
  sx?: object
  /** Scroll anchor, for in-page jumps from a summary tile. */
  id?: string
  /** Landmark role, e.g. "region" for a named dashboard panel. */
  role?: string
  /** Id of the element naming the card. */
  'aria-labelledby'?: string
}

/**
 * Plain white card with a token-driven 1px border and 10px radius. The
 * standard section wrapper on the Pillar Scores and OpDiv Dashboard pages
 * (overall score, pillar tiles, charts, question breakdown).
 * @param {CardProps} props - Body and optional sx.
 * @returns {JSX.Element} A simple card container.
 */
export default function Card({
  children,
  sx,
  id,
  role,
  'aria-labelledby': labelledBy,
}: CardProps) {
  return (
    <Box
      id={id}
      role={role}
      aria-labelledby={labelledBy}
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.25,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}
