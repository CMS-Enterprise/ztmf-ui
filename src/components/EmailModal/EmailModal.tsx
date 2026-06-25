import React from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import Modal from '@/components/ds/Modal'
import SentEmailsModal from './SentEmailsModal'
import { EmailModalProps } from '@/types'
import './EmailModal.css'
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            select
            label="Send to"
            required
            fullWidth
            name="email_group"
            value={groupValue}
            onChange={(e) => setGroupValue(e.target.value)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
          >
            <option value="">- Select an option -</option>
            {GROUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </TextField>
          <TextField
            label="Subject"
            required
            fullWidth
            name="email_subject"
            value={subject}
            inputProps={{ maxLength: 100 }}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Box>
            <TextField
              label="Message"
              required
              fullWidth
              multiline
              minRows={8}
              name="email_body"
              value={body}
              inputProps={{ maxLength: 2000 }}
              onChange={(e) => setBody(e.target.value)}
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
          </Box>
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
