import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import React, { useState, useEffect } from 'react'

type SnackbarProps = {
  open: boolean
  handleClose: () => void
  severity?: 'success' | 'error' | 'warning' | 'info'
  text: string
  duration: number
}

export default function CustomSnackbar({
  open,
  handleClose,
  severity,
  text,
  duration = 2000,
}: SnackbarProps) {
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
        autoHideDuration={duration}
        onClose={handleSnackbarClose}
      >
        <Alert severity={severity} variant="filled" sx={{ width: '100%' }}>
          {text}
        </Alert>
      </Snackbar>
    </div>
  )
}
