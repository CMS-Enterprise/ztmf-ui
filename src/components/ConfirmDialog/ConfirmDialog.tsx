import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { Box, IconButton, Typography, Button } from '@mui/material'
import { CONFIRMATION_MESSAGE } from '@/constants'
import { Button as CmsButton } from '@cmsgov/design-system'

import CloseIcon from '@mui/icons-material/Close'
type ConfirmDialogTypes = {
  open: boolean
  onClose: () => void
  confirmClick: (confirm: boolean) => void
}

const ConfirmDialog = ({ open, onClose, confirmClick }: ConfirmDialogTypes) => {
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
      <DialogTitle>Unsaved Changes</DialogTitle>
      <Box position="absolute" top={0} right={0}>
        <IconButton onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent>
        <Typography>{CONFIRMATION_MESSAGE}</Typography>
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
