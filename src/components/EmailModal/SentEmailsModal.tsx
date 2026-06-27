import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import EmailIcon from '@mui/icons-material/Email'
import Modal from '@/components/ds/Modal'
import { colors, radius } from '@/theme/tokens'
import { SentEmailDialogProps } from '@/types'

/**
 * Read-only list of email addresses that were sent in a recent batch. Renders
 * through the shared ds/Modal shell so it picks up the same header (eyebrow +
 * title + X), body padding, and footer treatment every other dialog uses.
 *
 * The address list is intentionally rendered as plain Boxes (not <ul>/<li>)
 * because the CMS DSG global stylesheet resets `ul { display: flex;
 * flex-direction: column; gap: 0.5em; padding-inline-start: 2em }` which
 * collides with MUI's List padding/alignment.
 * @param {SentEmailDialogProps} props - Open state, close handler, addresses
 *   that were emailed, and the recipient group name shown in the title.
 * @returns {JSX.Element} The sent-emails modal.
 */
export default function SentEmailsModal({
  openModal,
  closeModal,
  emails,
  group,
}: SentEmailDialogProps) {
  return (
    <Modal
      open={openModal}
      onClose={closeModal}
      size="md"
      dense
      eyebrow="Sent emails"
      title={`Sent to ${group}`}
      footer={
        <Button variant="contained" color="primary" onClick={closeModal}>
          Close
        </Button>
      }
    >
      {emails.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          No emails were sent.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            maxHeight: 480,
            overflowY: 'auto',
          }}
        >
          {emails.map((email) => (
            <Box
              key={email}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1,
                py: 1,
                borderRadius: `${radius.sm}px`,
                '&:hover': { backgroundColor: colors.neutral50 },
              }}
            >
              <EmailIcon
                sx={{ fontSize: 18, color: colors.neutral500, flexShrink: 0 }}
              />
              <Typography sx={{ fontSize: 13, color: colors.ink }}>
                {email}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Modal>
  )
}
