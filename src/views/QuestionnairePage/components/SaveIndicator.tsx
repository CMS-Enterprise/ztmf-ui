import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { colors } from '@/theme/tokens'
import LastEditedFooter from '../LastEditedFooter'
import { relativeTimeFrom } from '../helpers'

/** Audit info passed back to the tooltip from the score row. */
export type SaveIndicatorEditor = {
  userid: string
  name: string
  email: string
  role?: string
}

/** Props for {@link SaveIndicator}. */
export type SaveIndicatorProps = {
  /** Local time of the most recent successful save in this session. */
  lastSavedAt: Date | null
  /** Server-side last edit timestamp on the currently-displayed score. */
  lastEditedAt?: string | null
  /** Server-side last edit author on the currently-displayed score. */
  lastEditedBy?: SaveIndicatorEditor | null
  /** When true, render "Read-only" instead of the saved-time line. */
  isReadOnly: boolean
}

/**
 * Bottom-of-card save-status indicator. Shows the auto-save state to the
 * user as a small green check + "Saved <relative time>" line, and exposes
 * the underlying last-edited-by audit info via the hover tooltip. Switches
 * to a quiet "Read-only" tag when the user has no edit permissions.
 *
 * Keeps the tooltip body intentionally lightweight - all the audit detail
 * is in {@link LastEditedFooter}, which we reuse here so the questionnaire
 * page does not maintain two separate audit displays.
 * @param {SaveIndicatorProps} props - Component props.
 * @returns {JSX.Element} The save indicator.
 */
export default function SaveIndicator({
  lastSavedAt,
  lastEditedAt,
  lastEditedBy,
  isReadOnly,
}: SaveIndicatorProps) {
  if (isReadOnly) {
    return (
      <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
        Read-only
      </Typography>
    )
  }
  const text = lastSavedAt
    ? `Saved ${relativeTimeFrom(lastSavedAt)}`
    : 'Saved automatically'
  const tooltipBody =
    lastEditedBy && lastEditedAt ? (
      <LastEditedFooter
        lastEditedAt={lastEditedAt}
        lastEditedBy={lastEditedBy as unknown as never}
      />
    ) : null
  return (
    <Tooltip title={tooltipBody ?? ''}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <CheckCircleIcon sx={{ fontSize: 12, color: colors.up }} />
        <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
          {text}
        </Typography>
      </Box>
    </Tooltip>
  )
}
