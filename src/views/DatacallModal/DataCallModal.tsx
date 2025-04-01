import React from 'react'
import { useNavigate } from 'react-router-dom'
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
  FormControlLabel,
  FormControl,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useSnackbar } from 'notistack'
import { datacallModalProps } from '@/types'
import './DatacallModal.css'

export default function DataCallModal({ open, onClose }: datacallModalProps) {
  const { enqueueSnackbar } = useSnackbar()
  const [datacall, setDatacall] = React.useState<string>('')
  const [datacallError, setDatacallError] = React.useState<string>('')
  const [deadline, setDeadline] = React.useState<string>('')
  const [deadlineError, setDeadlineError] = React.useState<string>('')
  const datacallHint = () => {
    return (
      <Typography>
        Please use the format:{' '}
        <span>
          FY<i>XXXX</i> Q<i>X</i>
        </span>
      </Typography>
    )
  }
  function isValidFormat(input: string) {
    const pattern = /^FY\d{4} Q\d$/
    if (input.length != 9) {
      setDatacallError("")
    } else {
      if (input.length === 9 && pattern.test(input)) {
        setDatacallError("")
      } else {
        setDatacallError("Invalid datacall format")
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
    console.log(deadline.length, datacall.length, deadlineError.length, datacallError.length)
  }
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
      <DialogContent>
        <Box display="flex" flexDirection="row" sx={{ height: '50vh' }}>
          <form>
            <CMSTextField
              label="Please enter a datacall name"
              maxLength={9}
              hint={datacallHint()}
              name="datacall"
              onChange={handleDatacallChange}
              labelClassName="datacall-label"
              errorMessage={datacallError}
            />
            <SingleInputDateField
              label="Please enter a deadline date for this datacall"
              name="deadline-date"
              errorMessage={deadlineError}
              numeric
              maxLength={8}
              onBlur={validateDeadline}
              onChange={(e) => {
                setDeadline(e)
              }}
              value=""
            />
          </form>
        </Box>
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
          disabled={datacall.length !== 0 && deadline.length !== 0 && datacallError.length === 0 && deadlineError.length === 0 ? false : true}
        >
          Create
        </CmsButton>
      </DialogActions>
    </Dialog>
  )
}
