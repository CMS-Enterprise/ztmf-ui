import React from 'react'
import {
  Box,
  Button,
  MenuItem,
  OutlinedInput,
  Select,
  Typography,
} from '@mui/material'
import Modal from '@/components/ds/Modal'
import Field, { fieldInputSx } from '@/components/ds/Field'
import SentEmailsModal from './SentEmailsModal'
import { EmailModalProps } from '@/types'
import axiosInstance from '@/axiosConfig'
import { ERROR_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { colors, fonts } from '@/theme/tokens'

const GROUP_OPTIONS = [
  { label: 'ISSO', value: 'ISSO' },
  { label: 'ISSM', value: 'ISSM' },
  { label: 'ADMIN', value: 'ADMIN' },
  { label: 'READONLY_ADMIN', value: 'READONLY_ADMIN' },
  { label: 'DCC', value: 'DCC' },
  { label: 'ALL', value: 'ALL' },
]

/**
 * Email-users modal. Sends a mass email to a selected role group. Migrated to
 * the shared Modal shell (rounded, X close, Cancel beside the primary action)
 * while keeping the same fields and the same POST /massemails behavior.
 * @param {EmailModalProps} props - Open state and close handler.
 * @returns {JSX.Element} The email-users modal.
 */
export default function EmailModal({ openModal, closeModal }: EmailModalProps) {
  const [sentToEmails, setSentToEmails] = React.useState<string[]>([])
  const [openSentEmailsDialog, setOpenSentEmailsDialog] =
    React.useState<boolean>(false)
  const closeSentEmailsDialog = () => {
    setOpenSentEmailsDialog(false)
  }
  const [groupValue, setGroupValue] = React.useState<string>('')
  const [subject, setSubject] = React.useState<string>('')
  const [body, setBody] = React.useState<string>('')
  const [sentGroup, setSentGroup] = React.useState<string>('')
  const resetEmailInputs = () => {
    setBody('')
    setGroupValue('')
    setSubject('')
    setSentToEmails([])
  }
  const handleClose = () => {
    setTimeout(() => {
      resetEmailInputs()
    }, 200)
    closeModal()
  }
  const submitEmail = async () => {
    try {
      const res = await axiosInstance.post('/massemails', {
        group: groupValue,
        subject,
        body,
      })
      setSentGroup(groupValue)
      notify('Emails have successfully been sent', 'success', {
        autoHideDuration: 2500,
      })
      setSentToEmails(res.data.data)
    } catch (error) {
      if (isAuthHandled(error)) return
      notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 2500 })
    }
  }

  return (
    <>
      <Modal
        open={openModal}
        onClose={handleClose}
        title="Email users"
        size="md"
        disableBackdropClose
        footer={
          <>
            {sentToEmails.length !== 0 && (
              <Button
                variant="outlined"
                color="primary"
                sx={{ mr: 'auto' }}
                onClick={() => setOpenSentEmailsDialog(true)}
              >
                View recipients
              </Button>
            )}
            <Button variant="text" color="inherit" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={!(subject && groupValue && body)}
              onClick={submitEmail}
            >
              Send
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Field id="email_group" label="Send to" required>
            <Select
              id="email_group"
              name="email_group"
              displayEmpty
              fullWidth
              // The Field component renders a <label htmlFor="email_group">,
              // but MUI Select's combobox role needs aria-labelledby. The
              // labelId points back at the label that Field renders so a11y
              // tooling sees "Send to" as the accessible name.
              labelId="email_group-label"
              inputProps={{ 'aria-labelledby': 'email_group-label' }}
              value={groupValue}
              onChange={(e) => setGroupValue(e.target.value)}
              input={<OutlinedInput sx={fieldInputSx} />}
              renderValue={(selected) =>
                selected ? (
                  selected
                ) : (
                  <Box component="span" sx={{ color: colors.neutral500 }}>
                    Select a recipient group
                  </Box>
                )
              }
            >
              {GROUP_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </Field>
          <Field id="email_subject" label="Subject" required>
            <OutlinedInput
              id="email_subject"
              name="email_subject"
              fullWidth
              value={subject}
              inputProps={{ maxLength: 100 }}
              onChange={(e) => setSubject(e.target.value)}
              sx={fieldInputSx}
            />
          </Field>
          <Field id="email_body" label="Message" required>
            <OutlinedInput
              id="email_body"
              name="email_body"
              fullWidth
              multiline
              minRows={8}
              value={body}
              inputProps={{ maxLength: 2000 }}
              onChange={(e) => setBody(e.target.value)}
              sx={fieldInputSx}
            />
            <Typography
              variant="caption"
              sx={{
                color: colors.neutral500,
                mt: 0.5,
                display: 'block',
                textAlign: 'right',
                fontFamily: fonts.mono,
              }}
            >
              {body.length} / 2000
            </Typography>
          </Field>
        </Box>
      </Modal>
      <SentEmailsModal
        openModal={openSentEmailsDialog}
        closeModal={closeSentEmailsDialog}
        emails={sentToEmails}
        group={sentGroup}
      />
    </>
  )
}
