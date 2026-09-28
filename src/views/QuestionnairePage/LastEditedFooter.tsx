import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LastEditedBy } from '@/types'
import { formatDateTime } from '@/utils/dates'

type Props = {
  lastEditedAt?: string | null
  lastEditedBy?: LastEditedBy | null
}

export default function LastEditedFooter({
  lastEditedAt,
  lastEditedBy,
}: Props) {
  if (!lastEditedAt || !lastEditedBy || !lastEditedBy.name) return null

  const { name, email, role } = lastEditedBy
  const caption = `Last edited by ${name}${role ? ` (${role})` : ''} - ${formatDateTime(lastEditedAt, lastEditedAt)}`
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
