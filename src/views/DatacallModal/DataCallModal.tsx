import React from 'react'
import { Box, Button, OutlinedInput } from '@mui/material'
import Modal from '@/components/ui/Modal'
import Field, { fieldInputSx } from '@/components/ui/Field'
import { datacallModalProps } from '@/types'
import axiosInstance from '@/axiosConfig'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { radius } from '@/theme/tokens'

// Accepts both the CMS quarterly cadence (FYYYYY QN) and the HHS annual
// ZTM cadence (FYYY ZTM). Widened when the HHS onboarding mock addon
// introduced FY23/FY24/FY25 ZTM datacall names.
const DATACALL_NAME_PATTERN = /^FY(\d{2}|\d{4}) (Q[1-4]|ZTM)$/
const DATACALL_MAX_LENGTH = 10 // "FY2025 ZTM" = 10 chars; longest valid form
const DATACALL_MIN_LENGTH = 7 // "FY23 Q1" / "FY23 ZTM" share the floor

/**
 * Create-datacall modal. Renders through the shared Modal shell and uses
 * label-above-input fields that resist the global CMS Design System
 * resets. The native date input constrains the deadline to real calendar
 * dates, so no impossible-date rollover check is needed here.
 * @param {datacallModalProps} props - Open state, close handler, and the
 *   optional onCreated callback fired after a successful create so the
 *   caller can refresh its data-call list.
 * @returns {JSX.Element} The create-datacall modal.
 */
export default function DataCallModal({
  open,
  onClose,
  onCreated,
}: datacallModalProps) {
  const [datacall, setDatacall] = React.useState<string>('')
  const [datacallError, setDatacallError] = React.useState<string>('')
  const [deadline, setDeadline] = React.useState<string>('')
  const [deadlineError, setDeadlineError] = React.useState<string>('')
  // Guards against a double-submit (fast double-click or double-Enter) that
  // would otherwise fire two POSTs before the modal auto-closes and creates
  // duplicate datacalls server-side.
  const [submitting, setSubmitting] = React.useState<boolean>(false)

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
      setSubmitting(false)
    }
  }, [open])

  function isValidFormat(input: string) {
    // Below the shortest valid form, stay quiet: the user is mid-typing.
    if (input.length < DATACALL_MIN_LENGTH) {
      setDatacallError('')
      return
    }
    setDatacallError(
      DATACALL_NAME_PATTERN.test(input) ? '' : 'Invalid datacall format'
    )
  }

  const handleDatacallChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDatacall(value)
    isValidFormat(value.toUpperCase())
  }

  // Fires "required" only on blur - an untouched field stays quiet on mount
  // and only complains once the user has engaged with it and left it empty.
  // The on-change path (above) still reports format errors as-you-type.
  const handleDatacallBlur = () => {
    if (datacall.length === 0) {
      setDatacallError('Datacall name is required')
    }
  }

  const validateDeadline = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length === 0) {
      setDeadlineError('Deadline is required')
      return
    }
    if (value.length === 10 && !isNaN(Date.parse(value))) {
      setDeadline(value)
      setDeadlineError('')
    } else {
      setDeadlineError('Invalid Deadline')
    }
  }

  const submitDatacall = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await axiosInstance.post(`/datacalls`, {
        datacall: datacall.toUpperCase(),
        deadline: new Date(deadline).toISOString(),
      })
      notify('Datacall has successfully been created', 'success', {
        autoHideDuration: 2500,
      })
      // Refresh the caller's data-call list so the newly created call
      // appears in the picker without a manual page reload, then close.
      onCreated?.()
      onClose()
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
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    DATACALL_NAME_PATTERN.test(datacall.toUpperCase()) &&
    deadline.length === 10 &&
    datacallError.length === 0 &&
    deadlineError.length === 0 &&
    !submitting

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
            {submitting ? 'Creating...' : 'Create'}
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
          helperText="Use the format FYXXXX QX (FY2024 Q1) or FYXX ZTM (FY25 ZTM)."
        >
          <OutlinedInput
            id="datacall-name"
            name="datacall"
            fullWidth
            value={datacall}
            inputProps={{
              maxLength: DATACALL_MAX_LENGTH,
              'aria-label': 'Datacall name',
            }}
            onChange={handleDatacallChange}
            onBlur={handleDatacallBlur}
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
