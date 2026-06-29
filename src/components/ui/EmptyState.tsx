import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, status } from '@/theme/tokens'

/** Color intent for the {@link EmptyState} icon circle. */
export type EmptyStateTone = 'info' | 'warning' | 'neutral'

const TONE: Record<EmptyStateTone, { circle: string; icon: string }> = {
  info: { circle: colors.primary50, icon: colors.primary },
  // Warning + neutral pull from the shared status palette so this surface
  // never drifts from StatusChip and other warning-toned components.
  warning: { circle: status.warning.bg, icon: status.warning.color },
  neutral: { circle: status.neutral.bg, icon: colors.neutral500 },
}

/** Props for {@link EmptyState}. */
export type EmptyStateProps = {
  /** Icon element rendered inside the circle. */
  icon: ReactNode
  /** Short headline that names the empty condition. */
  title: string
  /** Optional sentence explaining why it is empty and what to do next. */
  description?: ReactNode
  /** Optional action, usually a button. */
  action?: ReactNode
  /** Icon circle color intent. Defaults to info. */
  tone?: EmptyStateTone
}

/**
 * Standard empty state used across lists, tables, drawers and detail cards.
 *
 * Every empty surface explains why it is empty and what the user can do next,
 * instead of leaving a blank field. Centralizes the pattern the audit flagged
 * as missing (Assign Systems, deleted users, system insights).
 * @param {EmptyStateProps} props - Icon, title, optional copy and action.
 * @returns {JSX.Element} A centered empty state block.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'info',
}: EmptyStateProps) {
  const palette = TONE[tone]
  return (
    <Box sx={{ textAlign: 'center', px: 4, py: 6 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.circle,
          color: palette.icon,
          mb: 3,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {description && (
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 500,
            color: colors.neutral500,
            maxWidth: 380,
            mx: 'auto',
            mb: action ? 3 : 0,
          }}
        >
          {description}
        </Typography>
      )}
      {action}
    </Box>
  )
}

export default EmptyState
