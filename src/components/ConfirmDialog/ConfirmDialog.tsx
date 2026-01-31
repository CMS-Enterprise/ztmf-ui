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
}

const ConfirmDialog = ({
  open,
  onClose,
  confirmClick,
  confirmationText,
  title,
}: ConfirmDialogTypes) => {
  const handleConfirm = () => {
    confirmClick(true)
    onClose()
  }
  const handleClose = () => {
    confirmClick(false)
    onClose()
  }
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>{title || 'Unsaved Changes'}</DialogTitle>
      <Box position="absolute" top={0} right={0}>
        <IconButton onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent>
        <Typography>{confirmationText}</Typography>
      </DialogContent>
      <DialogActions>
        <CmsButton variation="solid" onClick={handleConfirm}>
          Confirm
        </CmsButton>
        <CmsButton onClick={handleClose}>Cancel</CmsButton>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
