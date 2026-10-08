import { ElementType, ReactNode } from 'react'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'

/** Props for {@link Eyebrow}. */
export type EyebrowProps = {
  children: ReactNode
  /** Element to render, e.g. "h2" when the eyebrow is the section's heading. */
  component?: ElementType
  id?: string
  /** Optional sx overrides (spacing only - the type style is the point). */
  sx?: object
}

/**
 * Tiny uppercased eyebrow line shown above a section heading or stat. Used
 * to label cards ("OVERALL ZT SCORE", "TREND VS PREVIOUS") at the same
 * visual weight everywhere it appears on the page.
 * @param {EyebrowProps} props - Component props.
 * @returns {JSX.Element} The eyebrow text.
 */
export default function Eyebrow({
  children,
  component = 'p',
  id,
  sx,
}: EyebrowProps) {
  return (
    <Typography
      component={component}
      id={id}
      sx={{
        fontSize: 11,
        fontWeight: 600,
        color: colors.neutral500,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        ...sx,
      }}
    >
      {children}
    </Typography>
  )
}
