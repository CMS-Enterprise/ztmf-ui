import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LastEditedBy } from '@/types'

type Props = {
  lastEditedAt?: string | null
  lastEditedBy?: LastEditedBy | null
  /**
   * Opens the answer-history drawer (ztmf-misc#392). Omitted when there is no
   * history to show, which also keeps every existing caller's output byte for
   * byte what it was.
   */
  onViewHistory?: () => void
}

function formatHumanDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function LastEditedFooter({
  lastEditedAt,
  lastEditedBy,
  onViewHistory,
}: Props) {
  if (!lastEditedAt || !lastEditedBy || !lastEditedBy.name) return null

  const { name, email, role } = lastEditedBy
  const caption = `Last edited by ${name}${role ? ` (${role})` : ''} — ${formatHumanDate(lastEditedAt)}`
  const tooltip = `${email} · ${lastEditedAt}`

  // The link is a SIBLING of the Tooltip, not a child of it. Tooltip forwards
  // its ref to a single child and labels it, so nesting a control inside would
  // put an interactive element under an ancestor's aria-label - a 508 finding
  // on a gate that enforces at `serious` with an empty baseline.
  return (
    <Box sx={{ textAlign: 'center', mt: 1 }}>
      <Tooltip title={tooltip} placement="top">
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'inline' }}
        >
          {caption}
        </Typography>
      </Tooltip>
      {onViewHistory && (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'inline' }}
          >
            {' · '}
          </Typography>
          <Link
            id="view-answer-history"
            component="button"
            type="button"
            variant="caption"
            onClick={onViewHistory}
            sx={{ verticalAlign: 'baseline' }}
          >
            View history
          </Link>
        </>
      )}
    </Box>
  )
}
