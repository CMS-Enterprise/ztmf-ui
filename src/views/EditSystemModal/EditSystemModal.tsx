import * as React from 'react'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import CustomDialogTitle from '../../components/DialogTitle/CustomDialogTitle'
import { Button as CmsButton } from '@cmsgov/design-system'
import { Box, Grid } from '@mui/material'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import {
  editSystemModalProps,
  FismaSystemType,
  FormValidType,
  FormValidHelperText,
} from '@/types'
import MenuItem from '@mui/material/MenuItem'
import { CONFIRMATION_MESSAGE } from '@/constants'

import ValidatedTextField from './ValidatedTextField'
import { emailValidator } from './validators'
import { EMPTY_SYSTEM } from './emptySystem'
import { datacenterenvironment } from './dataEnvironment'
import CircularProgress from '@mui/material/CircularProgress'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import _ from 'lodash'
import axiosInstance from '@/axiosConfig'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import {
  ERROR_MESSAGES,
  TEXTFIELD_HELPER_TEXT,
  INVALID_INPUT_TEXT,
} from '@/constants'
import { useSnackbar } from 'notistack'
/**
 * Component that renders a modal to edit fisma systems.
 * @param {boolean, function, FismaSystemType} editSystemModalProps - props to get populate dialog and function .
 * @returns {JSX.Element} Component that renders a dialog to edit details of a fisma systems.
 */

export default function EditSystemModal({
  title,
  open,
  onClose,
  system,
  mode,
}: editSystemModalProps) {
  const [formValid, setFormValid] = React.useState<FormValidType>({
    issoemail: false,
    datacallcontact: false,
    fismaname: false,
    fismaacronym: false,
    datacenterenvironment: false,
    component: false,
    fismauid: false,
  })
  const isFormValid = (): boolean => {
    return Object.values(formValid).every((value) => value === true)
  }
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [loading, setLoading] = React.useState<boolean>(true)
  const [openAlert, setOpenAlert] = React.useState<boolean>(false)
  const [openDecommissionAlert, setOpenDecommissionAlert] =
    React.useState<boolean>(false)
  const [formValidErrorText, setFormValidErrorText] =
    React.useState<FormValidHelperText>({
      issoemail: TEXTFIELD_HELPER_TEXT,
      datacallcontact: TEXTFIELD_HELPER_TEXT,
      fismaname: TEXTFIELD_HELPER_TEXT,
      fismaacronym: TEXTFIELD_HELPER_TEXT,
      datacenterenvironment: TEXTFIELD_HELPER_TEXT,
      component: TEXTFIELD_HELPER_TEXT,
      fismauid: TEXTFIELD_HELPER_TEXT,
    })
  const handleConfirmReturn = (confirm: boolean) => {
    if (confirm) {
      onClose(EMPTY_SYSTEM)
    }
  }
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    key: string
  ) => {
    const value = e.target.value
    const isValid = value.length > 0

    setEditedFismaSystem((prevState) => ({
      ...prevState,
      [key]: value,
    }))
    setFormValid((prevState) => ({
      ...prevState,
      [key]: isValid,
    }))
    if (!isValid) {
      setFormValidErrorText((prevState) => ({
        ...prevState,
        [key]: isValid ? '' : TEXTFIELD_HELPER_TEXT,
      }))
    }
  }
  const [editedFismaSystem, setEditedFismaSystem] =
    React.useState<FismaSystemType>(EMPTY_SYSTEM)
  React.useEffect(() => {
    if (system && open) {
      setFormValid((prevState) => ({
        ...prevState,
        issoemail:
          system?.issoemail && system?.issoemail.length > 0 ? true : false,
        datacallcontact:
          system?.datacallcontact && system?.datacallcontact.length > 0
            ? true
            : false,
        fismaname:
          system?.fismaname && system?.fismaname.length > 0 ? true : false,
        fismaacronym:
          system?.fismaacronym && system?.fismaacronym.length > 0
            ? true
            : false,
        datacenterenvironment:
          system?.datacenterenvironment &&
          system?.datacenterenvironment.length > 0
            ? true
            : false,
        component:
          system?.component && system?.component.length > 0 ? true : false,
        fismauid:
          system?.fismauid && system?.fismauid.length > 0 ? true : false,
      }))
      setEditedFismaSystem(system)
      setLoading(false)
    }
  }, [system, open])
  const handleClose = () => {
    if (_.isEqual(system, editedFismaSystem)) {
      onClose(editedFismaSystem)
    } else {
      setOpenAlert(true)
    }
    return
  }
  const handleSave = async () => {
    if (mode === 'edit') {
      await axiosInstance
        .put(`fismasystems/${editedFismaSystem.fismasystemid}`, {
          fismauid: editedFismaSystem.fismauid,
          fismaacronym: editedFismaSystem.fismaacronym,
          fismaname: editedFismaSystem.fismaname,
          fismasubsystem: editedFismaSystem.fismasubsystem,
          component: editedFismaSystem.component,
          groupacronym: editedFismaSystem.groupacronym,
          groupname: editedFismaSystem.groupname,
          divisionname: editedFismaSystem.divisionname,
          datacenterenvironment: editedFismaSystem.datacenterenvironment,
          datacallcontact: editedFismaSystem.datacallcontact,
          issoemail: editedFismaSystem.issoemail,
        })
        .then((res) => {
          if (res.status !== 200 && res.status.toString()[0] === '4') {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.expired,
              },
            })
          }
          enqueueSnackbar(`Saved`, {
            variant: 'success',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 1500,
          })
          onClose(editedFismaSystem)
        })
        .catch((error) => {
          if (error.response.status === 400) {
            const data: { [key: string]: string } = error.response.data.data
            Object.entries(data).forEach(([key]) => {
              // formValid.current[key] = false
              setFormValid((prevState) => ({
                ...prevState,
                [key]: false,
              }))
              setFormValidErrorText((prevState) => ({
                ...prevState,
                [key]: INVALID_INPUT_TEXT(key),
              }))
            })
            enqueueSnackbar(`Not Saved`, {
              variant: 'error',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 1500,
            })
          } else {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.error,
              },
            })
          }
        })
    } else if (mode === 'create') {
      await axiosInstance
        .post(`fismasystems`, {
          fismauid: editedFismaSystem.fismauid,
          fismaacronym: editedFismaSystem.fismaacronym,
          fismaname: editedFismaSystem.fismaname,
          fismasubsystem: editedFismaSystem.fismasubsystem,
          component: editedFismaSystem.component,
          groupacronym: editedFismaSystem.groupacronym,
          groupname: editedFismaSystem.groupname,
          divisionname: editedFismaSystem.divisionname,
          datacenterenvironment: editedFismaSystem.datacenterenvironment,
          datacallcontact: editedFismaSystem.datacallcontact,
          issoemail: editedFismaSystem.issoemail,
        })
        .then((res) => {
          if (res.status !== 200 && res.status.toString()[0] === '4') {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.expired,
              },
            })
          }
          enqueueSnackbar(`Created`, {
            variant: 'success',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 1500,
          })
          onClose(editedFismaSystem)
        })
        .catch((error) => {
          if (error.response.status === 400) {
            const data: { [key: string]: string } = error.response.data.data
            Object.entries(data).forEach(([key]) => {
              // formValid.current[key] = false
              setFormValid((prevState) => ({
                ...prevState,
                [key]: false,
              }))
              setFormValidErrorText((prevState) => ({
                ...prevState,
                [key]: INVALID_INPUT_TEXT(key),
              }))
            })
            enqueueSnackbar(`Not Created`, {
              variant: 'error',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 1500,
            })
          } else {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.error,
              },
            })
          }
        })
    }
  }
  const handleDecommission = async () => {
    setOpenDecommissionAlert(false)
    await axiosInstance
      .delete(`fismasystems/${editedFismaSystem.fismasystemid}`)
      .then((res) => {
        if (res.status === 204) {
          enqueueSnackbar('System decommissioned successfully', {
            variant: 'success',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 2000,
          })
          onClose(editedFismaSystem)
        }
      })
      .catch((error) => {
        if (error.response?.status === 403) {
          enqueueSnackbar('Permission denied. Admin access required.', {
            variant: 'error',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 2000,
          })
        } else if (error.response?.status === 404) {
          enqueueSnackbar('System not found', {
            variant: 'error',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 2000,
          })
        } else {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.error,
            },
          })
        }
      })
  }
  if (open && system) {
    if (loading) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            maxHeight: '100%',
          }}
        >
          <CircularProgress size={80} />
        </Box>
      )
    }
    return (
      <>
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
          <CustomDialogTitle title={`${title} Fisma System`} />
          <DialogContent>
            <Box sx={{ flexGrow: 1 }} component="form">
              <Grid container spacing={2}>
                <Grid item xs={7}>
                  <TextField
                    id="fismaname"
                    label="Fisma Name"
                    required
                    fullWidth
                    margin="normal"
                    variant="standard"
                    defaultValue={system?.fismaname || ''}
                    error={!formValid.fismaname ? true : false}
                    helperText={
                      !formValid.fismaname ? formValidErrorText.fismaname : ''
                    }
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      handleInputChange(e, 'fismaname')
                    }}
                  />
                  <TextField
                    id="fismaacronym"
                    label="Fisma Acronym"
                    required
                    variant="standard"
                    margin="normal"
                    defaultValue={system?.fismaacronym || ''}
                    error={!formValid.fismaacronym ? true : false}
                    helperText={
                      !formValid.fismaacronym
                        ? formValidErrorText.fismaacronym
                        : ''
                    }
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      handleInputChange(e, 'fismaacronym')
                    }}
                  />
                  <TextField
                    id="groupacronym"
                    label="Group Acronym"
                    variant="standard"
                    margin="normal"
                    defaultValue={system?.groupacronym || ''}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    sx={{ ml: 2 }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        groupacronym: e.target.value,
                      }))
                    }}
                  />
                  <TextField
                    id="component"
                    label="Component"
                    variant="standard"
                    required
                    margin="normal"
                    defaultValue={system?.component || ''}
                    error={!formValid.component ? true : false}
                    helperText={
                      !formValid.component ? formValidErrorText.component : ''
                    }
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    sx={{ ml: 2 }}
                    onChange={(e) => {
                      handleInputChange(e, 'component')
                    }}
                  />
                  <TextField
                    id="groupname"
                    label="Group Name"
                    variant="standard"
                    margin="normal"
                    fullWidth
                    defaultValue={system?.groupname || ''}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        groupname: e.target.value,
                      }))
                    }}
                  />

                  <TextField
                    id="divisionname"
                    label="Division Name"
                    variant="standard"
                    margin="normal"
                    fullWidth
                    defaultValue={system?.divisionname}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        divisionname: e.target.value,
                      }))
                    }}
                  />
                  <TextField
                    id="fismasubsystem"
                    label="Fisma Subsystem"
                    variant="standard"
                    margin="normal"
                    fullWidth
                    defaultValue={system?.fismasubsystem}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        fismasubsystem: e.target.value,
                      }))
                    }}
                  />
                </Grid>
                <Grid item xs={5}>
                  <ValidatedTextField
                    label="Data Call Contact"
                    validator={emailValidator}
                    dfValue={system?.datacallcontact || ''}
                    isFullWidth={true}
                    onChange={(isValid, newValue) => {
                      setFormValid((prevState) => ({
                        ...prevState,
                        datacallcontact: isValid,
                      }))
                      if (isValid) {
                        setEditedFismaSystem((prevState) => ({
                          ...prevState,
                          datacallcontact: newValue,
                        }))
                      }
                    }}
                  />
                  <ValidatedTextField
                    label="ISSO Email"
                    validator={emailValidator}
                    dfValue={system?.issoemail || ''}
                    isFullWidth={true}
                    onChange={(isValid, newValue) => {
                      setFormValid((prevState) => ({
                        ...prevState,
                        issoemail: isValid,
                      }))
                      if (isValid) {
                        setEditedFismaSystem((prevState) => ({
                          ...prevState,
                          issoemail: newValue,
                        }))
                      }
                    }}
                  />

                  <TextField
                    id="fismauid"
                    label="Fisma UID"
                    variant="standard"
                    margin="normal"
                    fullWidth
                    defaultValue={system?.fismauid || ''}
                    error={!formValid.fismauid ? true : false}
                    helperText={
                      !formValid.fismauid ? formValidErrorText.fismauid : ''
                    }
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      handleInputChange(e, 'fismauid')
                    }}
                  />
                  <TextField
                    id="outlined-select-datacenterenvironment"
                    required
                    select
                    label="Datacenter Environment"
                    variant="standard"
                    defaultValue={system?.datacenterenvironment || ''}
                    fullWidth
                    error={!formValid.datacenterenvironment ? true : false}
                    helperText={
                      !formValid.datacenterenvironment
                        ? formValidErrorText.datacenterenvironment
                        : ''
                    }
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    sx={{ mt: 2 }}
                    onChange={(e) => {
                      handleInputChange(e, 'datacenterenvironment')
                    }}
                  >
                    {datacenterenvironment.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  {mode === 'edit' && (
                    <Box
                      sx={{
                        mt: 3,
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={system?.decommissioned || false}
                            disabled={system?.decommissioned || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setOpenDecommissionAlert(true)
                              }
                            }}
                            sx={{
                              color: '#d32f2f',
                              '&.Mui-checked': {
                                color: '#d32f2f',
                              },
                            }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Decommission System
                          </Typography>
                        }
                      />
                      {system?.decommissioned &&
                        system?.decommissioned_date && (
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              ml: 4,
                              color: 'text.secondary',
                            }}
                          >
                            Decommissioned on:{' '}
                            {new Date(
                              system.decommissioned_date
                            ).toLocaleDateString()}
                          </Typography>
                        )}
                      {!system?.decommissioned && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            ml: 4,
                            color: 'text.secondary',
                          }}
                        >
                          Mark this system as decommissioned (current date)
                        </Typography>
                      )}
                    </Box>
                  )}
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <CmsButton
              variation="solid"
              onClick={handleSave}
              disabled={!isFormValid()}
            >
              {mode === 'edit' ? 'Save' : 'Create'}
            </CmsButton>
            <CmsButton onClick={handleClose} color="primary">
              Close
            </CmsButton>
          </DialogActions>
        </Dialog>
        <ConfirmDialog
          confirmationText={CONFIRMATION_MESSAGE}
          open={openAlert}
          onClose={() => setOpenAlert(false)}
          confirmClick={handleConfirmReturn}
        />
        <ConfirmDialog
          confirmationText={`Are you sure you want to decommission "${system?.fismaname}"? This will mark the system as decommissioned with today's date and hide it from the active systems list. This action cannot be undone through the UI.`}
          open={openDecommissionAlert}
          onClose={() => setOpenDecommissionAlert(false)}
          confirmClick={(confirm: boolean) => {
            if (confirm) {
              handleDecommission()
            } else {
              setOpenDecommissionAlert(false)
            }
          }}
        />
      </>
    )
  }
  return <></>
}
