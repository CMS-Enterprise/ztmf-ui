import React from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  IconButton,
} from '@mui/material'
import {
  TextField as CMSTextField,
  Dropdown,
  InlineError,
  Button as CMSButton,
  Label,
} from '@cmsgov/design-system'
import SentEmailsModal from './SentEmailsModal'
import { useSnackbar } from 'notistack'
import TextField from '@mui/material/TextField'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { EmailModalProps } from '@/types'
import './EmailModal.css'
import { styled } from '@mui/material'
import axiosInstance from '@/axiosConfig'
import { ERROR_MESSAGES } from '@/constants'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
const CssTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#000000',
      borderWidth: '2px',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#000000',
      borderWidth: '2px',
      boxShadow: '0px 0px 0px 3px #FFFFFF, 0px 0px 3px 6px #bd13b8',
    },

    '&.Mui-error fieldset': {
      borderColor: 'rgb(227, 28, 61)',
      borderWidth: '3px',
    },
    '@supports (-moz-appearance:none)': {
      '& .MuiInputBase-inputMultiline': {
        paddingTop: '15px',
        height: '100%',
        width: '100%',
        scrollbarWidth: 'none',
      },
    },
    '& .MuiInputBase-inputMultiline': {
      msOverflowStyle: 'none', // Hide scrollbar in IE/Edge
      '&::-webkit-scrollbar': { display: 'none' },
    },
  },
})

export default function EmailModal({ openModal, closeModal }: EmailModalProps) {
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
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
  const submitEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await axiosInstance
      .post('/massemails', {
        group: formData.get('email_group'),
        subject: formData.get('email_subject'),
        body: formData.get('email_body'),
      })
      .then((res) => {
        setSentGroup(groupValue)
        enqueueSnackbar(`Emails have successfully been sent`, {
          variant: 'success',
          anchorOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          autoHideDuration: 2500,
        })
        setSentToEmails(res.data.data)
      })
      .catch((error) => {
        if (error.response.status === 401) {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.expired,
            },
          })
        }
        else if (error.response.status === 403) {
          enqueueSnackbar(ERROR_MESSAGES.permission, {
            variant: 'error',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 2500,
          })
        } else {
          enqueueSnackbar(
            ERROR_MESSAGES.tryAgain,
            {
              variant: 'error',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 2500,
            }
          )
        }
      })
  }

  const handleChange = (value: string) => {
    setGroupValue(value)
  }
  const handleSubjectChange = (value: string) => {
    setSubject(value)
  }
  const handleBodyChange = (value: string) => {
    setBody(value)
  }
  return (
    <>
      <Dialog
        open={openModal}
        onClose={() => {
          setTimeout(() => {
            resetEmailInputs()
          }, 200)
          closeModal()
        }}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 0,
            boxShadow: '3px 3px 5px',
            // height: 725,
            minHeight: '95vh',
            maxHeight: '95vh',
          },
        }}
      >
        <DialogTitle id="email-dialog-title">
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            className={'ds-u-font-size--2xl ds-u-font-weight--bold'}
          >
            {'Email Users'}
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
                setTimeout(() => {
                  resetEmailInputs()
                }, 200)
                closeModal()
              }}
            >
              <CloseRoundedIcon
                fontSize="large"
                sx={{ color: 'rgb(90, 90, 90)' }}
              />
            </IconButton>
          </Box>
        </DialogTitle>
        <form onSubmit={submitEmail}>
          <DialogContent sx={{ pt: 0, ml: 1 }}>
            <Dropdown
              label="Select the group to email"
              name="email_group"
              errorMessage={
                groupValue.length === 0 ? 'This field is required' : ''
              }
              // errorMessage={'This field is required'}
              labelClassName="group-label"
              onChange={(e) => handleChange(e.target.value)}
              options={[
                {
                  label: '- Select an option -',
                  value: '',
                },
                {
                  label: 'ISSO',
                  value: 'ISSO',
                },
                {
                  label: 'ISSM',
                  value: 'ISSM',
                },
                {
                  label: 'ADMIN',
                  value: 'ADMIN',
                },
                {
                  label: 'DCC',
                  value: 'DCC',
                },
                {
                  label: 'ALL',
                  value: 'ALL',
                },
              ]}
            />
            <CMSTextField
              label="Subject"
              maxLength={100}
              name="email_subject"
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="subject-label-text"
              labelClassName="label"
              errorMessage={
                subject.length === 0 ? 'This field is required' : ''
              }
            />
            <Label className="label">Body</Label>
            {!body && <InlineError>This field is required</InlineError>}
            <CssTextField
              multiline
              rows={13}
              fullWidth
              name="email_body"
              margin="none"
              inputProps={{ maxLength: 2000 }}
              error={!body}
              onChange={(e) => handleBodyChange(e.target.value)}
            />
          </DialogContent>
          <DialogActions
            sx={{
              justifyContent: 'flex-start',
              ml: 3,
              mb: 1,
            }}
          >
            <CMSButton
              variation="solid"
              type="submit"
              disabled={subject && groupValue && body ? false : true}
            >
              Send
            </CMSButton>
            {sentToEmails.length !== 0 ? (
              <CMSButton
                variation="solid"
                onClick={() => setOpenSentEmailsDialog(true)}
              >
                Emails sent to ...
              </CMSButton>
            ) : (
              <></>
            )}
          </DialogActions>
        </form>
      </Dialog>
      <SentEmailsModal
        openModal={openSentEmailsDialog}
        closeModal={closeSentEmailsDialog}
        emails={sentToEmails}
        group={sentGroup}
      />
    </>
  )
}
