import React from 'react'
import {
  Button as CmsButton,
  TextField as CMSTextField,
  SingleInputDateField,
} from '@cmsgov/design-system'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  DialogActions,
  Typography,
  // FormControlLabel,
  // FormControl,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { datacallModalProps } from '@/types'
import './DatacallModal.css'
import axiosInstance from '@/axiosConfig'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'

// Accepts both the CMS quarterly cadence (FYYYYY QN) and the HHS annual
// ZTM cadence (FYYY ZTM). Widened when the HHS onboarding mock addon
// introduced FY23/FY24/FY25 ZTM datacall names.
const DATACALL_NAME_PATTERN = /^FY(\d{2}|\d{4}) (Q[1-4]|ZTM)$/
const DATACALL_MAX_LENGTH = 10 // "FY2025 ZTM" = 10 chars; longest valid form
const DEADLINE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/

// Verifies MM/DD/YYYY is a real calendar date - Date.parse silently rolls
// impossible dates over (02/30 -> Mar 2, 04/31 -> May 1), which would
// otherwise let the user submit a wrong date without any feedback. Reject
// unless the parsed date's month/day round-trip exactly.
function isValidCalendarDate(mdY: string): boolean {
  const match = mdY.match(DEADLINE_PATTERN)
  if (!match) return false
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const d = new Date(year, month - 1, day)
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  )
}

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

  // Reset state when the modal is closed so the next open starts clean.
  // Prevents stale errors and half-typed input from bleeding across sessions
  // (see feedback: modals clear validation on close).
  React.useEffect(() => {
    if (!open) {
      setDatacall('')
      setDatacallError('')
      setDeadline('')
      setDeadlineError('')
      setSubmitting(false)
    }
  }, [open])

  const datacallHint = () => {
    return (
      <Typography>
        Please use the format:{' '}
        <span>
          FY<i>XXXX</i> Q<i>X</i>
        </span>{' '}
        or{' '}
        <span>
          FY<i>XX</i> ZTM
        </span>
      </Typography>
    )
  }
  // Validates on every change so the user is never left with a disabled
  // Create button and no explanation. Empty input still resets the error
  // (an untouched field should not scream at the user).
  function isValidFormat(input: string) {
    if (input.length === 0) {
      setDatacallError('')
      return
    }
    if (DATACALL_NAME_PATTERN.test(input)) {
      setDatacallError('')
    } else {
      setDatacallError('Invalid datacall format')
    }
  }
  const handleDatacallChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDatacall(value)
    isValidFormat(value.toUpperCase())
  }
  // Fires "Required" only on blur - matches the standard form UX where an
  // untouched field stays quiet on mount and only complains once the user
  // has engaged with it and left it empty. The on-change path (above) still
  // reports format errors as-you-type without touching this branch.
  const handleDatacallBlur = () => {
    if (datacall.length === 0) {
      setDatacallError('Datacall name is required')
    }
  }
  // Deadline validation mirrors the blur logic but only fires once the
  // input has reached the 10-char MM/DD/YYYY shape - partial input stays
  // quiet so the field does not flash red on every keystroke.
  const validateDeadlineValue = (value: string) => {
    if (value.length < 10) {
      setDeadlineError('')
      return
    }
    if (!isValidCalendarDate(value)) {
      setDeadlineError('Invalid Deadline')
      return
    }
    setDeadlineError('')
  }
  const validateDeadline = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length === 0) {
      setDeadlineError('Deadline is required')
      return
    }
    if (value.length === 10 && isValidCalendarDate(value)) {
      setDeadline(value)
      setDeadlineError('')
    } else {
      setDeadlineError('Invalid Deadline')
    }
  }
  const submitDatacall = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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

  const nameValid = DATACALL_NAME_PATTERN.test(datacall.toUpperCase())
  const deadlineComplete = deadline.length === 10 && !deadlineError
  const isCreateDisabled =
    !nameValid ||
    !deadlineComplete ||
    datacallError.length !== 0 ||
    deadlineError.length !== 0 ||
    submitting
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 0,
          boxShadow: '3px 3px 5px',
        },
      }}
    >
      <DialogTitle id="datacall-dialog-title">
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
          className={'ds-u-font-size--2xl ds-u-font-weight--bold'}
        >
          {'Create a datacall'}
          <IconButton
            size="large"
            sx={{
              p: 0,
              borderRadius: 0,
              '&:hover': {
                backgroundColor: 'white',
              },
            }}
            onClick={() => {
              // setTimeout(() => {
              //   resetEmailInputs()
              // }, 200)
              onClose()
            }}
          >
            <CloseRoundedIcon
              fontSize="large"
              sx={{ color: 'rgb(90, 90, 90)' }}
            />
          </IconButton>
        </Box>
      </DialogTitle>
      <form onSubmit={submitDatacall}>
        <DialogContent sx={{ pt: 0 }}>
          <CMSTextField
            label="Please enter a datacall name"
            maxLength={DATACALL_MAX_LENGTH}
            hint={datacallHint()}
            name="datacall"
            onChange={handleDatacallChange}
            onBlur={handleDatacallBlur}
            labelClassName="datacall-label"
            errorMessage={datacallError}
          />
          <SingleInputDateField
            label="Please enter a deadline date for this datacall"
            hint={"Please include the '/'"}
            name="deadline-date"
            errorMessage={deadlineError}
            maxLength={10}
            onBlur={validateDeadline}
            onChange={(e) => {
              setDeadline(e)
              validateDeadlineValue(e)
            }}
            value={deadline}
          />
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: 'flex-start',
            ml: 3,
            mb: 1,
          }}
        >
          <CmsButton
            variation="solid"
            type="submit"
            disabled={isCreateDisabled}
          >
            {submitting ? 'Creating...' : 'Create'}
          </CmsButton>
        </DialogActions>
      </form>
    </Dialog>
  )
}
