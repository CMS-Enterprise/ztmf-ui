import { useId } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { Box, IconButton, Typography } from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'

import CloseIcon from '@mui/icons-material/Close'
type ConfirmDialogTypes = {
  open: boolean
  onClose: () => void
  confirmClick: (confirm: boolean) => void
  confirmationText: string
  title?: string
  /** Verb-first label for the affirmative action, e.g. "Deactivate". */
  confirmLabel?: string
  cancelLabel?: string
}

const ConfirmDialog = ({
  open,
  onClose,
  confirmClick,
  confirmationText,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}: ConfirmDialogTypes) => {
  const titleId = useId()
  const descId = useId()
  const handleConfirm = () => {
    confirmClick(true)
    onClose()
  }
  const handleClose = () => {
    confirmClick(false)
    onClose()
  }
  return (
    // onClose wires Escape and backdrop click to the safe (cancel) path so a
    // keyboard user can always back out of a destructive prompt. The dialog is
    // associated with its title and message for screen readers.
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <DialogTitle id={titleId}>{title || 'Unsaved Changes'}</DialogTitle>
      <Box position="absolute" top={0} right={0}>
        <IconButton onClick={handleClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent>
        <Typography id={descId}>{confirmationText}</Typography>
      </DialogContent>
      <DialogActions>
        {/* Affirmative action listed first, but MUI moves initial focus to the
            Close (cancel) control on open, so an accidental Enter backs out
            rather than firing the destructive action. */}
        <CmsButton variation="solid" onClick={handleConfirm}>
          {confirmLabel}
        </CmsButton>
        <CmsButton onClick={handleClose}>{cancelLabel}</CmsButton>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
