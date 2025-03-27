import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  IconButton,
} from '@mui/material'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import EmailIcon from '@mui/icons-material/Email'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { Button as CMSButton } from '@cmsgov/design-system'
import { SentEmailDialogProps } from '@/types'
export default function SentEmailsModal({
  openModal,
  closeModal,
  emails,
  group,
}: SentEmailDialogProps) {
  return (
    <Dialog
      open={openModal}
      onClose={closeModal}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 0,
          boxShadow: '3px 3px 5px',
          minHeight: '90vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle id="email-dialog-title">
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
          className={'ds-u-font-size--2xl ds-u-font-weight--bold'}
        >
          {`Emails Sent to ${group}'s`}
          <IconButton
            size="large"
            sx={{
              p: 0,
              borderRadius: 0,
              '&:hover': {
                backgroundColor: 'white',
              },
            }}
            onClick={closeModal}
          >
            <CloseRoundedIcon
              fontSize="large"
              sx={{ color: 'rgb(90, 90, 90)' }}
            />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ overflow: 'hidden' }}>
        <List
          sx={{
            width: '100%',
            // maxWidth: 500,
            bgcolor: 'background.paper',
            position: 'relative',
            overflow: 'auto',
            overflowX: 'hidden',
            maxHeight: 600,
            '& ul': { padding: 0 },
          }}
        >
          {emails.map((email) => (
            <ListItem key={email}>
              <ListItemIcon key={`${email}-icon`}>
                <EmailIcon />
              </ListItemIcon>
              <ListItemText key={`email-${email}`}>{email}</ListItemText>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions
        sx={{
          justifyContent: 'flex-start',
          ml: 3,
          mb: 3,
        }}
      >
        <CMSButton variation="solid" onClick={closeModal}>
          Close
        </CMSButton>
      </DialogActions>
    </Dialog>
  )
}
