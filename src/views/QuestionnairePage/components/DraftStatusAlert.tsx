import Alert from '@mui/material/Alert'
import type { DraftStatus } from '../useQuestionDraft'

const MESSAGES: Record<Exclude<DraftStatus, 'idle'>, string> = {
  saved: 'Draft saved - click Next or Complete to save permanently.',
  error:
    'Draft could not be saved - click Next or Complete to save permanently.',
  restored: 'Draft restored - click Next or Complete to save permanently.',
}

const SEVERITY = {
  saved: 'success',
  error: 'error',
  restored: 'warning',
} as const

/**
 * Tells the user where their unsaved edit lives: in a local draft that was
 * just saved, failed to save, or was restored. Renders nothing while idle.
 * @param {{ status: DraftStatus }} props - The draft's status.
 * @returns {JSX.Element | null} The alert, or nothing.
 */
export default function DraftStatusAlert({ status }: { status: DraftStatus }) {
  if (status === 'idle') return null
  return (
    <Alert severity={SEVERITY[status]} icon={false} sx={{ mt: 1, py: 0.5 }}>
      {MESSAGES[status]}
    </Alert>
  )
}
