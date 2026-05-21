import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LastEditedBy } from '@/types'

type Props = {
  lastEditedAt?: string | null
  lastEditedBy?: LastEditedBy | null
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
}: Props) {
  if (!lastEditedAt || !lastEditedBy || !lastEditedBy.name) return null

  const { name, email, role } = lastEditedBy
  const caption = `Last edited by ${name}${role ? ` (${role})` : ''} — ${formatHumanDate(lastEditedAt)}`
  const tooltip = `${email} · ${lastEditedAt}`

  return (
    <Tooltip title={tooltip} placement="top">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', textAlign: 'center', mt: 1 }}
      >
        {caption}
      </Typography>
    </Tooltip>
  )
}
