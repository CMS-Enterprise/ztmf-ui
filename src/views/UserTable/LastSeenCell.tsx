import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import {
  LAST_SEEN_EMPTY_LABEL,
  formatLastSeenAbsolute,
  formatLastSeenRelative,
} from './lastSeen'

type Props = {
  value: Date | null
  /** Injectable clock for tests; defaults to the real current time. */
  now?: Date
}

/**
 * View cell for the "Last seen" column: relative time with the absolute
 * timestamp on hover, or a neutral empty state for rows with no recorded
 * activity (deliberately not blank, so "never seen" is a visible, scannable
 * state rather than an ambiguous hole in the grid).
 */
export default function LastSeenCell({ value, now }: Props) {
  if (!value) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontStyle: 'italic' }}
      >
        {LAST_SEEN_EMPTY_LABEL}
      </Typography>
    )
  }
  return (
    <Tooltip title={formatLastSeenAbsolute(value)} placement="top">
      <Typography variant="body2">
        {formatLastSeenRelative(value, now ?? new Date())}
      </Typography>
    </Tooltip>
  )
}
