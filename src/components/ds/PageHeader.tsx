import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'

/** Props for {@link PageHeader}. */
export type PageHeaderProps = {
  /** Page title, rendered as the h1. */
  title: ReactNode
  /** Optional secondary line under the title (count, context, timestamp). */
  subtitle?: ReactNode
  /** Optional breadcrumb element rendered above the title. */
  breadcrumbs?: ReactNode
  /** Optional right-aligned actions, usually one primary plus secondaries. */
  actions?: ReactNode
}

/**
 * Consistent page header used at the top of every list and detail view.
 *
 * Gives every page the same shape: breadcrumb, then an h1 title with an
 * optional subtitle on the left, and a right-aligned action area. Replaces the
 * mix of bare labels and oversized headings the audit flagged.
 * @param {PageHeaderProps} props - Title, subtitle, breadcrumbs and actions.
 * @returns {JSX.Element} The page header block.
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <Box sx={{ mb: 5 }}>
      {breadcrumbs && <Box sx={{ mb: 2.5 }}>{breadcrumbs}</Box>}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: colors.ink,
              lineHeight: 1.1,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              sx={{
                mt: 1,
                fontSize: 14,
                fontWeight: 500,
                color: colors.neutral500,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>{actions}</Box>
        )}
      </Box>
    </Box>
  )
}

export default PageHeader
