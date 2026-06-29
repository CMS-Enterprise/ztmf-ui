import React from 'react'
import { Box, Button, OutlinedInput } from '@mui/material'
import Modal from '@/components/ui/Modal'
import Field, { fieldInputSx } from '@/components/ui/Field'
import { datacallModalProps } from '@/types'
import axiosInstance from '@/axiosConfig'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { radius } from '@/theme/tokens'

/**
 * Create-datacall modal. Renders through the shared Modal shell and uses
 * label-above-input fields that resist the global CMS Design System
 * resets. Validation and POST behavior are unchanged from the previous
 * implementation; the visual layer is the only change.
 * @param {datacallModalProps} props - Open state and close handler.
 * @returns {JSX.Element} The create-datacall modal.
 */
export default function DataCallModal({ open, onClose }: datacallModalProps) {
  const [datacall, setDatacall] = React.useState<string>('')
  const [datacallError, setDatacallError] = React.useState<string>('')
  const [deadline, setDeadline] = React.useState<string>('')
  const [deadlineError, setDeadlineError] = React.useState<string>('')

  // Modals stay mounted across open/close so React preserves their state.
  // Without this reset, a user who triggers a validation error (e.g. blurs
  // an invalid date), closes the modal, and reopens it would still see the
  // red error from the previous session. Reset on the open->false edge so
  // the next open starts with the same empty/valid state as a fresh mount.
  React.useEffect(() => {
    if (!open) {
      setDatacall('')
      setDatacallError('')
      setDeadline('')
      setDeadlineError('')
    }
  }, [open])

  function isValidFormat(input: string) {
    const pattern = /^FY\d{4} Q\d$/
    if (input.length !== 9) {
      setDatacallError('')
      return
    }
    setDatacallError(pattern.test(input) ? '' : 'Invalid datacall format')
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
      eyebrow="New datacall"
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
            sx={{ borderRadius: `${radius.button}px` }}
          >
            Create
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Field
          id="datacall-name"
          label="Name"
          required
          error={datacallError}
          helperText="Use the format FYXXXX QX, for example FY2024 Q1."
        >
          <OutlinedInput
            id="datacall-name"
            name="datacall"
            fullWidth
            value={datacall}
            inputProps={{ maxLength: 9, 'aria-label': 'Datacall name' }}
            onChange={handleDatacallChange}
            error={!!datacallError}
            sx={fieldInputSx}
          />
        </Field>

        <Field
          id="datacall-deadline"
          label="Deadline"
          required
          error={deadlineError}
        >
          <OutlinedInput
            id="datacall-deadline"
            name="deadline-date"
            type="date"
            fullWidth
            value={deadline}
            inputProps={{ 'aria-label': 'Datacall deadline' }}
            onBlur={validateDeadline}
            onChange={(e) => setDeadline(e.target.value)}
            error={!!deadlineError}
            sx={fieldInputSx}
          />
        </Field>
      </Box>
    </Modal>
  )
}
