import React from 'react'
import {
  Alert,
  Box,
  Button,
  OutlinedInput,
  Select,
  Typography,
} from '@mui/material'
import Modal from '@/components/ui/Modal'
import Field, { fieldInputSx } from '@/components/ui/Field'
import { DatacallCadence, datacallModalProps } from '@/types'
import { useCreateDatacall } from '@/utils/datacalls'
import {
  newestPublishedVersion,
  previousDatacall,
  useQuestionnaireVersions,
} from '@/utils/questionnaireVersions'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { radius } from '@/theme/tokens'

// The title is free text. The fiscal year and cadence are their own fields,
// so nothing has to be encoded in the title. 100 matches the column.
const DATACALL_MAX_LENGTH = 100
const FISCAL_YEAR_PATTERN = /^\d{4}$/
// The title becomes a questionnaire URL segment (encodeDatacallSlug), where
// these characters would split or cut off the path.
const TITLE_URL_UNSAFE = /[/?#%\\]/
const TITLE_URL_UNSAFE_ERROR = 'Title cannot contain / ? # % or \\'

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
  datacalls = [],
}: datacallModalProps) {
  const [datacall, setDatacall] = React.useState<string>('')
  const [datacallError, setDatacallError] = React.useState<string>('')
  const [fiscalYear, setFiscalYear] = React.useState<string>('')
  const [fiscalYearError, setFiscalYearError] = React.useState<string>('')
  const [cadence, setCadence] = React.useState<DatacallCadence>('annual')
  const [deadline, setDeadline] = React.useState<string>('')
  const [deadlineError, setDeadlineError] = React.useState<string>('')

  // The API pins the newest published version; this only shows it (ztmf-misc#432).
  const versions = useQuestionnaireVersions({ enabled: open })
  const pinned = newestPublishedVersion(versions)
  const previous = previousDatacall(datacalls, deadline)
  const previousVersion = versions.find(
    (v) => v.versionid === previous?.questionnaire_versionid
  )
  const versionChanges =
    pinned != null &&
    previous?.questionnaire_versionid != null &&
    previous.questionnaire_versionid !== pinned.versionid

  // Guards against a double-submit (fast double-click or double-Enter) that
  // would otherwise fire two POSTs before the modal auto-closes and creates
  // duplicate datacalls server-side.

  const createDatacallMutation = useCreateDatacall()
  // The mutation owns the in-flight state; it guards re-entry in
  // submitDatacall and drives the disabled Create button and its label.
  const submitting = createDatacallMutation.isPending
  const { reset: resetCreateDatacall } = createDatacallMutation

  // Modals stay mounted across open/close so React preserves their state.
  // Without this reset, a user who triggers a validation error (e.g. blurs
  // an invalid date), closes the modal, and reopens it would still see the
  // red error from the previous session. Reset on the open->false edge so
  // the next open starts with the same empty/valid state as a fresh mount.
  React.useEffect(() => {
    if (!open) {
      setDatacall('')
      setDatacallError('')
      setFiscalYear('')
      setFiscalYearError('')
      setCadence('annual')
      setDeadline('')
      setDeadlineError('')
      // The modal stays mounted between opens, so the mutation's in-flight
      // state would otherwise survive a close. Closing during a create and
      // reopening would show a disabled "Creating..." button over an empty
      // form.
      resetCreateDatacall()
    }
  }, [open, resetCreateDatacall])

  const handleDatacallChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDatacall(value)
    if (TITLE_URL_UNSAFE.test(value)) setDatacallError(TITLE_URL_UNSAFE_ERROR)
    else if (value.trim().length > 0) setDatacallError('')
  }

  // Fires "required" only on blur - an untouched field stays quiet on mount
  // and only complains once the user has engaged with it and left it empty.
  const handleDatacallBlur = () => {
    if (datacall.trim().length === 0) {
      setDatacallError('Title is required')
    }
  }

  const handleFiscalYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim()
    setFiscalYear(value)
    if (FISCAL_YEAR_PATTERN.test(value)) setFiscalYearError('')
  }

  // Same quiet-until-blur rule as the title, so a half-typed year is not an
  // error yet.
  const handleFiscalYearBlur = () => {
    if (fiscalYear.length === 0) {
      setFiscalYearError('Fiscal year is required')
    } else if (!FISCAL_YEAR_PATTERN.test(fiscalYear)) {
      setFiscalYearError('Use a four-digit year, such as 2027')
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
    try {
      await createDatacallMutation.mutateAsync({
        datacall: datacall.trim(),
        fiscal_year: Number(fiscalYear),
        cadence,
        deadline: new Date(deadline).toISOString(),
      })
      notify('Datacall has successfully been created', 'success', {
        autoHideDuration: 2500,
      })
      // Refresh the caller's data-call list so the newly created call appears
      // in the picker without a manual page reload, then close. The mutation
      // also invalidates the data-call key, which reaches nothing while the
      // layout holds this list in state; drop this callback when that read
      // becomes a query.
      onCreated?.()
      onClose()
    } catch (error) {
      if (isAuthHandled(error)) return
      const parsed = parseApiError(error)
      // Backend 400 with a field map: route each reason to the matching
      // field's error setter. A reason with no field here (such as
      // questionnaire_versionid) is toasted rather than lost.
      if (parsed.fieldErrors) {
        const unplaced: string[] = []
        Object.entries(parsed.fieldErrors).forEach(([key, message]) => {
          if (key === 'datacall') setDatacallError(message)
          else if (key === 'fiscal_year') setFiscalYearError(message)
          else if (key === 'deadline') setDeadlineError(message)
          else unplaced.push(message)
        })
        if (unplaced.length > 0) {
          notify(unplaced.join(' '), 'error', { autoHideDuration: 4000 })
        }
        return
      }
      notify(parsed.message, 'error', { autoHideDuration: 2500 })
    }
  }

  const canSubmit =
    datacall.trim().length > 0 &&
    FISCAL_YEAR_PATTERN.test(fiscalYear) &&
    deadline.length === 10 &&
    datacallError.length === 0 &&
    fiscalYearError.length === 0 &&
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
          label="Title"
          required
          error={datacallError}
          helperText="Shown in the data call picker."
        >
          <OutlinedInput
            id="datacall-name"
            name="datacall"
            fullWidth
            value={datacall}
            inputProps={{
              maxLength: DATACALL_MAX_LENGTH,
              'aria-label': 'Datacall title',
            }}
            onChange={handleDatacallChange}
            onBlur={handleDatacallBlur}
            error={!!datacallError}
            sx={fieldInputSx}
          />
        </Field>

        <Field
          id="datacall-fiscal-year"
          label="Fiscal year"
          required
          error={fiscalYearError}
        >
          <OutlinedInput
            id="datacall-fiscal-year"
            name="fiscal_year"
            fullWidth
            value={fiscalYear}
            placeholder="2027"
            inputProps={{
              inputMode: 'numeric',
              maxLength: 4,
              'aria-label': 'Datacall fiscal year',
            }}
            onChange={handleFiscalYearChange}
            onBlur={handleFiscalYearBlur}
            error={!!fiscalYearError}
            sx={fieldInputSx}
          />
        </Field>

        <Field
          id="datacall-cadence"
          label="Cadence"
          helperText="Quarterly calls get their own trend series."
        >
          <Select
            native
            fullWidth
            value={cadence}
            inputProps={{
              id: 'datacall-cadence',
              'aria-label': 'Datacall cadence',
            }}
            onChange={(e) => setCadence(e.target.value as DatacallCadence)}
            sx={fieldInputSx}
          >
            <option value="annual">Annual</option>
            <option value="quarterly">Quarterly</option>
          </Select>
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

        {pinned && (
          <Typography variant="body2" color="text.secondary">
            Questionnaire version: <strong>{pinned.label}</strong>
          </Typography>
        )}
        {versionChanges && previous && pinned && (
          <Alert severity="warning">
            {previous.datacall} used{' '}
            {previousVersion?.label ?? 'an earlier questionnaire version'}.
            Answers carried forward from it will move to {pinned.label}, and
            answers to questions that version removed will not carry forward.
          </Alert>
        )}
      </Box>
    </Modal>
  )
}
