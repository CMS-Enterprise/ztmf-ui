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
  const [decommissionDate, setDecommissionDate] = React.useState<string>('')
  const [decommissionDateError, setDecommissionDateError] =
    React.useState<string>('')
  const [decommissionNotes, setDecommissionNotes] = React.useState<string>('')
  const [showDecommissionForm, setShowDecommissionForm] =
    React.useState<boolean>(false)
  const [decommissionedByName, setDecommissionedByName] =
    React.useState<string>('')
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
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      setDecommissionDate(`${yyyy}-${mm}-${dd}`)
      setDecommissionDateError('')
      setDecommissionNotes('')
      setShowDecommissionForm(false)
      setLoading(false)
    }
  }, [system, open])
  React.useEffect(() => {
    let cancelled = false
    if (open && system?.decommissioned && system?.decommissioned_by) {
      const userId = system.decommissioned_by
      axiosInstance
        .get(`users/${userId}`)
        .then((res) => {
          if (!cancelled && system?.decommissioned_by === userId) {
            if (res.data?.fullname) {
              setDecommissionedByName(res.data.fullname)
            } else {
              setDecommissionedByName(userId)
            }
          }
        })
        .catch(() => {
          if (!cancelled && system?.decommissioned_by === userId) {
            setDecommissionedByName(userId)
          }
        })
    } else {
      setDecommissionedByName('')
    }
    return () => {
      cancelled = true
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
  const validateDecommissionDate = (dateStr: string): boolean => {
    if (!dateStr) {
      setDecommissionDateError('Date is required')
      return false
    }
    const parsed = new Date(dateStr + 'T00:00:00.000Z')
    if (isNaN(parsed.getTime())) {
      setDecommissionDateError('Invalid date')
      return false
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (parsed > today) {
      setDecommissionDateError('Date cannot be in the future')
      return false
    }
    setDecommissionDateError('')
    return true
  }
  const getTodayISO = (): string => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const handleDecommission = async () => {
    setOpenDecommissionAlert(false)
    if (!validateDecommissionDate(decommissionDate)) {
      return
    }
    const isoDate = new Date(decommissionDate + 'T00:00:00.000Z').toISOString()
    const trimmedNotes = decommissionNotes.trim()
    const body: {
      decommissioned_date: string
      notes?: string
    } = {
      decommissioned_date: isoDate,
    }
    if (trimmedNotes) {
      body.notes = trimmedNotes
    }
    await axiosInstance
      .delete(`fismasystems/${editedFismaSystem.fismasystemid}`, {
        data: body,
      })
      .then((res) => {
        if (res.status === 200 || res.status === 204) {
          enqueueSnackbar('System decommissioned successfully', {
            variant: 'success',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 2000,
          })
          const updatedSystem: FismaSystemType = res.data || {
            ...editedFismaSystem,
            decommissioned: true,
            decommissioned_date: isoDate,
            decommissioned_notes: trimmedNotes || null,
          }
          onClose(updatedSystem)
        }
      })
      .catch((error) => {
        console.error(
          'Decommission error:',
          error.response?.status,
          error.response?.data
        )
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
        } else if (error.response?.status === 400) {
          const errorMsg = error.response?.data?.error || 'Invalid request'
          enqueueSnackbar(`Error: ${errorMsg}`, {
            variant: 'error',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 3000,
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
                      {system?.decommissioned ? (
                        <>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 500, mb: 1 }}
                          >
                            System Decommissioned
                          </Typography>
                          {!showDecommissionForm && (
                            <>
                              {system?.decommissioned_date && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    ml: 2,
                                    color: 'text.secondary',
                                  }}
                                >
                                  Date:{' '}
                                  {new Date(
                                    system.decommissioned_date
                                  ).toLocaleDateString()}
                                </Typography>
                              )}
                              {system?.decommissioned_by && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    ml: 2,
                                    color: 'text.secondary',
                                  }}
                                >
                                  By:{' '}
                                  {decommissionedByName ||
                                    system.decommissioned_by}
                                </Typography>
                              )}
                              {system?.decommissioned_notes && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    ml: 2,
                                    mt: 0.5,
                                    color: 'text.secondary',
                                  }}
                                >
                                  Notes: {system.decommissioned_notes}
                                </Typography>
                              )}
                              <CmsButton
                                size="small"
                                onClick={() => {
                                  if (system?.decommissioned_date) {
                                    const d = new Date(
                                      system.decommissioned_date
                                    )
                                    const yyyy = d.getFullYear()
                                    const mm = String(
                                      d.getMonth() + 1
                                    ).padStart(2, '0')
                                    const dd = String(d.getDate()).padStart(
                                      2,
                                      '0'
                                    )
                                    setDecommissionDate(`${yyyy}-${mm}-${dd}`)
                                  }
                                  setDecommissionNotes(
                                    system?.decommissioned_notes || ''
                                  )
                                  setShowDecommissionForm(true)
                                }}
                                style={{ marginTop: '8px' }}
                              >
                                Edit Decommission Details
                              </CmsButton>
                            </>
                          )}
                          {showDecommissionForm && (
                            <Box sx={{ ml: 2, mt: 1 }}>
                              <Typography
                                variant="body2"
                                sx={{ mb: 0.5, fontWeight: 500 }}
                              >
                                Decommission Date
                              </Typography>
                              <input
                                type="date"
                                value={decommissionDate}
                                max={getTodayISO()}
                                onChange={(e) => {
                                  setDecommissionDate(e.target.value)
                                  if (decommissionDateError) {
                                    validateDecommissionDate(e.target.value)
                                  }
                                }}
                                onBlur={(e) => {
                                  validateDecommissionDate(
                                    e.currentTarget.value
                                  )
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  fontSize: '14px',
                                  border: decommissionDateError
                                    ? '1px solid #d32f2f'
                                    : '1px solid #ccc',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box',
                                }}
                              />
                              {decommissionDateError && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#d32f2f',
                                    mt: 0.5,
                                    display: 'block',
                                  }}
                                >
                                  {decommissionDateError}
                                </Typography>
                              )}
                              <Typography
                                variant="body2"
                                sx={{ mt: 2, mb: 0.5, fontWeight: 500 }}
                              >
                                Notes (optional)
                              </Typography>
                              <textarea
                                value={decommissionNotes}
                                maxLength={500}
                                rows={3}
                                onChange={(e) =>
                                  setDecommissionNotes(e.target.value)
                                }
                                placeholder="Reason for decommission..."
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  fontSize: '14px',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box',
                                  fontFamily: 'inherit',
                                  resize: 'vertical',
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'text.secondary',
                                  display: 'block',
                                  mb: 1,
                                }}
                              >
                                {decommissionNotes.length}/500
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <CmsButton
                                  variation="solid"
                                  size="small"
                                  onClick={() => {
                                    if (
                                      validateDecommissionDate(decommissionDate)
                                    ) {
                                      setOpenDecommissionAlert(true)
                                    }
                                  }}
                                >
                                  Update
                                </CmsButton>
                                <CmsButton
                                  size="small"
                                  onClick={() => setShowDecommissionForm(false)}
                                >
                                  Cancel
                                </CmsButton>
                              </Box>
                            </Box>
                          )}
                        </>
                      ) : (
                        <>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={showDecommissionForm}
                                onChange={(e) => {
                                  setShowDecommissionForm(e.target.checked)
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
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                              >
                                Decommission System
                              </Typography>
                            }
                          />
                          {showDecommissionForm && (
                            <Box sx={{ ml: 4, mt: 1 }}>
                              <Typography
                                variant="body2"
                                sx={{ mb: 0.5, fontWeight: 500 }}
                              >
                                Decommission Date
                              </Typography>
                              <input
                                type="date"
                                value={decommissionDate}
                                max={getTodayISO()}
                                onChange={(e) => {
                                  setDecommissionDate(e.target.value)
                                  if (decommissionDateError) {
                                    validateDecommissionDate(e.target.value)
                                  }
                                }}
                                onBlur={(e) => {
                                  validateDecommissionDate(
                                    e.currentTarget.value
                                  )
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  fontSize: '14px',
                                  border: decommissionDateError
                                    ? '1px solid #d32f2f'
                                    : '1px solid #ccc',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box',
                                }}
                              />
                              {decommissionDateError && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#d32f2f',
                                    mt: 0.5,
                                    display: 'block',
                                  }}
                                >
                                  {decommissionDateError}
                                </Typography>
                              )}
                              <Typography
                                variant="body2"
                                sx={{ mt: 2, mb: 0.5, fontWeight: 500 }}
                              >
                                Notes (optional)
                              </Typography>
                              <textarea
                                value={decommissionNotes}
                                maxLength={500}
                                rows={3}
                                onChange={(e) =>
                                  setDecommissionNotes(e.target.value)
                                }
                                placeholder="Reason for decommission..."
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  fontSize: '14px',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box',
                                  fontFamily: 'inherit',
                                  resize: 'vertical',
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'text.secondary',
                                  display: 'block',
                                  mb: 1,
                                }}
                              >
                                {decommissionNotes.length}/500
                              </Typography>
                              <CmsButton
                                variation="solid"
                                onClick={() => {
                                  if (
                                    validateDecommissionDate(decommissionDate)
                                  ) {
                                    setOpenDecommissionAlert(true)
                                  }
                                }}
                                style={{
                                  marginTop: '12px',
                                  backgroundColor: '#d32f2f',
                                }}
                              >
                                Decommission
                              </CmsButton>
                            </Box>
                          )}
                        </>
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
          title={
            system?.decommissioned
              ? 'Update Decommission Details'
              : 'Confirm Decommission'
          }
          confirmationText={
            system?.decommissioned
              ? `Update decommission details for "${system?.fismaname}" to ${new Date(decommissionDate + 'T00:00:00.000Z').toLocaleDateString()}?${decommissionNotes.trim() ? ` Notes: "${decommissionNotes.trim().length > 100 ? decommissionNotes.trim().substring(0, 100) + '...' : decommissionNotes.trim()}"` : ''}`
              : `Are you sure you want to decommission "${system?.fismaname}" on ${new Date(decommissionDate + 'T00:00:00.000Z').toLocaleDateString()}?${decommissionNotes.trim() ? ` Notes: "${decommissionNotes.trim().length > 100 ? decommissionNotes.trim().substring(0, 100) + '...' : decommissionNotes.trim()}"` : ''} This will hide the system from the active systems list. This action cannot be undone through the UI.`
          }
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
