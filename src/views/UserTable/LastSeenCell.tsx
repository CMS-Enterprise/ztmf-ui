import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
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
  const absolute = formatLastSeenAbsolute(value)
  const relative = formatLastSeenRelative(value, now ?? new Date())
  return (
    <Tooltip title={absolute} placement="top">
      <Typography variant="body2">
        {relative}
        {/* The tooltip is hover-only, so the absolute timestamp also rides
            along visually hidden - a screen reader hears both, not just the
            relative phrase (508). A hidden span rather than aria-label
            because ARIA-in-HTML doesn't permit aria-label on a paragraph. */}
        <Box component="span" sx={visuallyHidden}>{` (${absolute})`}</Box>
      </Typography>
    </Tooltip>
  )
}
