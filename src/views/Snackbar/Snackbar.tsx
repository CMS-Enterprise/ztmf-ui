import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import React, { useState, useEffect } from 'react'

type SnackbarProps = {
  open: boolean
  handleClose: () => void
}

export default function SavedSnackbar({ open, handleClose }: SnackbarProps) {
  const [localOpen, setLocalOpen] = useState(open)

  useEffect(() => {
    setLocalOpen(open)
  }, [open])

  const handleSnackbarClose = (
    _: React.SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return
    }
    setLocalOpen(false)
    handleClose()
  }
  return (
    <div>
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        open={localOpen}
        autoHideDuration={2000}
        onClose={handleSnackbarClose}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          Saved
        </Alert>
      </Snackbar>
    </div>
  )
}
