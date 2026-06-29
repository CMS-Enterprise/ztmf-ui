import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import { colors, radius } from '@/theme/tokens'

/** Props for {@link Card}. */
export type CardProps = {
  /** Card body. */
  children: ReactNode
  /** Optional sx overrides spread onto the outer wrapper. */
  sx?: object
}

/**
 * Plain white card with a token-driven 1px border and 10px radius. Used as
 * the visual wrapper for every section of the Pillar Scores page (overall
 * score, pillar tiles, trend radar, question breakdown). Kept in this
 * subfolder rather than ds/ because the page is the only consumer; if a
 * second page ever wants the exact same shell, promote it to ds/Card.
 * @param {CardProps} props - Body and optional sx.
 * @returns {JSX.Element} A simple card container.
 */
export default function Card({ children, sx }: CardProps) {
  return (
    <Box
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
