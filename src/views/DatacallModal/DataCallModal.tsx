import React from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import Modal from '@/components/ds/Modal'
import { datacallModalProps } from '@/types'
import axiosInstance from '@/axiosConfig'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { colors } from '@/theme/tokens'

/**
 * Create-datacall modal. Renders through the shared Modal shell so it matches
 * every other dialog (rounded, X close top-right, Cancel beside the primary
 * action). The validation and POST behavior are unchanged from the previous
 * CMS Design System version.
 * @param {datacallModalProps} props - Open state and close handler.
 * @returns {JSX.Element} The create-datacall modal.
 */
export default function DataCallModal({ open, onClose }: datacallModalProps) {
  const [datacall, setDatacall] = React.useState<string>('')
  const [datacallError, setDatacallError] = React.useState<string>('')
  const [deadline, setDeadline] = React.useState<string>('')
  const [deadlineError, setDeadlineError] = React.useState<string>('')

  function isValidFormat(input: string) {
    const pattern = /^FY\d{4} Q\d$/
    if (input.length != 9) {
      setDatacallError('')
    } else {
      if (input.length === 9 && pattern.test(input)) {
        setDatacallError('')
      } else {
        setDatacallError('Invalid datacall format')
      }
    }
  }
  const handleDatacallChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDatacall(value)
    isValidFormat(value.toUpperCase())
  }
  const validateDeadline = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.length === 10 && !isNaN(Date.parse(e.target.value))) {
      setDeadline(e.target.value)
      setDeadlineError('')
    } else {
      setDeadlineError('Invalid Deadline')
    }
  }
  const submitDatacall = async () => {
    try {
      await axiosInstance.post(`/datacalls`, {
        datacall: datacall.toUpperCase(),
        deadline: new Date(deadline).toISOString(),
      })
      notify('Datacall has successfully been created', 'success', {
        autoHideDuration: 2500,
      })
    } catch (error) {
      if (isAuthHandled(error)) return
      const parsed = parseApiError(error)
      // Backend 400 with a field map: route each reason to the matching
      // field's error setter. No toast on this branch, the inline errors
      // are the user feedback.
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([key, message]) => {
          if (key === 'datacall') setDatacallError(message)
          else if (key === 'deadline') setDeadlineError(message)
        })
        return
      }
      notify(parsed.message, 'error', { autoHideDuration: 2500 })
    }
  }

  const canSubmit =
    datacall.length === 9 &&
    deadline.length === 10 &&
    datacallError.length === 0 &&
    deadlineError.length === 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create datacall"
      size="sm"
      disableBackdropClose
      footer={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!canSubmit}
            onClick={submitDatacall}
          >
            Create
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <TextField
            label="Datacall name"
            required
            fullWidth
            name="datacall"
            inputProps={{ maxLength: 9 }}
            onChange={handleDatacallChange}
            error={!!datacallError}
            helperText={datacallError || undefined}
          />
          <Typography
            variant="caption"
            sx={{ color: colors.neutral500, mt: 0.5, display: 'block' }}
          >
            Use the format FYXXXX QX, for example FY2024 Q1.
          </Typography>
        </Box>
        <TextField
          label="Deadline"
          required
          fullWidth
          type="date"
          name="deadline-date"
          InputLabelProps={{ shrink: true }}
          onBlur={validateDeadline}
          onChange={(e) => setDeadline(e.target.value)}
          error={!!deadlineError}
          helperText={deadlineError || undefined}
        />
      </Box>
    </Modal>
  )
}
