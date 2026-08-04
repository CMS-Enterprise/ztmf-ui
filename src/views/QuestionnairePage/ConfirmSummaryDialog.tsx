import { useId } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { Button as CmsButton } from '@cmsgov/design-system'
import type { ConfirmSummary, ConfirmSummaryEntry } from './confirmState'

type Props = {
  /** null keeps the dialog closed. */
  summary: ConfirmSummary | null
  onClose: () => void
  /** Navigate to the entry's question (the parent owns routing). */
  onJump: (entry: ConfirmSummaryEntry) => void
}

/**
 * The end-of-questionnaire summary shown by Complete on an open data call:
 * one "are you sure" moment instead of 40 per-question dialogs. Lists
 * carried-forward answers awaiting confirmation and unanswered questions as
 * jump links; when neither remains it is the success state (which also
 * retires the old silent loop back to question 1).
 */
const ConfirmSummaryDialog = ({ summary, onClose, onJump }: Props) => {
  const titleId = useId()
  const descId = useId()
  if (!summary) return null

  const outstanding = summary.unconfirmed.length + summary.unanswered.length
  const complete = outstanding === 0

  const entryList = (entries: ConfirmSummaryEntry[]) => (
    <List dense sx={{ pt: 0 }}>
      {entries.map((entry) => (
        <ListItem key={entry.functionid} sx={{ py: 0.25 }}>
          <Link
            component="button"
            type="button"
            onClick={() => onJump(entry)}
            sx={{ textAlign: 'left' }}
          >
            {entry.pillarName} — {entry.functionName}
          </Link>
        </ListItem>
      ))}
    </List>
  )

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={summary.hasStatusData ? descId : undefined}
    >
      <DialogTitle id={titleId}>
        {complete ? 'Questionnaire complete' : 'Before you finish'}
      </DialogTitle>
      <Box position="absolute" top={0} right={0}>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent>
        {/* The headline count reads scores.status; without status data (the
            backend not yet serving it) the count would be a lie built from
            absence, so it is omitted and only row-presence facts render. */}
        {summary.hasStatusData && (
          <Typography id={descId} sx={{ mb: 1 }}>
            {summary.updated} of {summary.total} answers counted as updated for
            this data call.
          </Typography>
        )}
        {complete ? (
          <Alert severity="success" icon={false}>
            Every question is answered
            {summary.hasStatusData ? ' and counted as updated' : ''}. You are
            done — no further action is needed.
          </Alert>
        ) : (
          <>
            {summary.unconfirmed.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography component="h3" sx={{ fontWeight: 700 }}>
                  Carried forward — needs confirmation (
                  {summary.unconfirmed.length})
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  These answers were carried over from the previous data call
                  and do not count as updated until you confirm them. Open each
                  question and select “Confirm this answer is still accurate,”
                  or update the answer.
                </Typography>
                {entryList(summary.unconfirmed)}
              </Box>
            )}
            {summary.unanswered.length > 0 && (
              <Box>
                <Typography component="h3" sx={{ fontWeight: 700 }}>
                  Unanswered ({summary.unanswered.length})
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  These questions have no answer yet. Open each question, select
                  an answer, and continue with Next or Complete to save it.
                </Typography>
                {entryList(summary.unanswered)}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <CmsButton onClick={onClose}>Close</CmsButton>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmSummaryDialog
