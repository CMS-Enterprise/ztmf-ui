import Box from '@mui/material/Box'
import { colors, fonts, radius, status } from '@/theme/tokens'

/** Visual intent for a {@link StatusChip}. */
export type StatusKind = 'active' | 'neutral' | 'warning' | 'danger'

const STATUS_COLORS: Record<
  StatusKind,
  { color: string; backgroundColor: string }
> = {
  active: { color: status.active.color, backgroundColor: status.active.bg },
  neutral: { color: status.neutral.color, backgroundColor: status.neutral.bg },
  warning: { color: status.warning.color, backgroundColor: status.warning.bg },
  danger: { color: status.danger.color, backgroundColor: status.danger.bg },
}

/** Props for {@link StatusChip}. */
export type StatusChipProps = {
  /** Text shown inside the pill. */
  label: string
  /** Color intent. Defaults to neutral. */
  kind?: StatusKind
  /** Show a leading status dot. Defaults to true. */
  dot?: boolean
}

/**
 * Small pill that communicates a record's status (Active, Decommissioned,
 * Invited, Deleted, and so on). Pill shape is reserved for chips and badges.
 * @param {StatusChipProps} props - Label, color intent and dot toggle.
 * @returns {JSX.Element} A rounded status pill.
 */
export function StatusChip({
  label,
  kind = 'neutral',
  dot = true,
}: StatusChipProps) {
  const palette = STATUS_COLORS[kind]
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        px: 2,
        py: 0.75,
        borderRadius: `${radius.pill}px`,
        color: palette.color,
        backgroundColor: palette.backgroundColor,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
          }}
        />
      )}
      {label}
    </Box>
  )
}

/** Props for {@link CodeBadge}. */
export type CodeBadgeProps = {
  /** Short code, for example an OpDiv acronym. */
  code: string
  /** Render muted (used for deactivated rows). */
  muted?: boolean
}

/**
 * Monospace badge for short canonical codes such as OpDiv acronyms. Square
 * corners (sm radius) keep it distinct from the pill-shaped status chips.
 * @param {CodeBadgeProps} props - The code string and muted flag.
 * @returns {JSX.Element} A monospace code badge.
 */
export function CodeBadge({ code, muted = false }: CodeBadgeProps) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontFamily: fonts.mono,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        px: 2,
        py: 0.5,
        borderRadius: `${radius.sm}px`,
        color: muted ? colors.neutral500 : colors.ink900,
        backgroundColor: muted ? colors.neutral100 : colors.primary50,
      }}
    >
      {code}
    </Box>
  )
}

export default StatusChip
