import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import { colors, radius } from '@/theme/tokens'

/** Props for {@link Card}. */
export type CardProps = {
  children: ReactNode
  sx?: object
}

/**
 * Plain white card with a token-driven 1px border and 10px radius. Used as
 * the visual wrapper for every section of the Questionnaire page (question
 * card, section progress, CISA reference, pillar rail). Same shape the
 * Pillar Scores page uses; kept locally because both pages already had
 * their own copy and a single shared component would force a barrel
 * decision before we have enough call sites to justify it.
 * @param {CardProps} props - Component props.
 * @returns {JSX.Element} A card container.
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
