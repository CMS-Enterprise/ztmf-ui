import Alert from '@mui/material/Alert'
import { radius, status } from '@/theme/tokens'

/** Props for {@link ClosedDatacallBanner}. */
export type ClosedDatacallBannerProps = {
  /** Whether the user is in a read-only mode (no edit permissions). */
  readOnly: boolean
}

/**
 * Warning-toned banner shown at the top of the Questionnaire page once a
 * datacall's deadline has passed. Copy switches between read-only and
 * post-deadline-edit phrasing so admins and ISSOs see the right message.
 * Palette pulls from status.warning so it stays in lockstep with every
 * other warning surface in the app.
 * @param {ClosedDatacallBannerProps} props - Component props.
 * @returns {JSX.Element} The warning banner.
 */
export default function ClosedDatacallBanner({
  readOnly,
}: ClosedDatacallBannerProps) {
  const text = readOnly
    ? 'This datacall is closed. Responses are read-only. To edit, switch to an active datacall or contact your HHS admin.'
    : 'This datacall has closed. Changes will be recorded as post-deadline.'
  return (
    <Alert
      severity="warning"
      sx={{
        mb: 2,
        backgroundColor: status.warning.bg,
        color: status.warning.color,
        border: `1px solid #FBC97A`,
        borderRadius: `${radius.md}px`,
        '& .MuiAlert-icon': { color: status.warning.color },
      }}
    >
      {text}
    </Alert>
  )
}
