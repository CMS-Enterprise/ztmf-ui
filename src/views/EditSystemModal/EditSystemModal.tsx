import * as React from 'react'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import CustomDialogTitle from '../../components/DialogTitle/CustomDialogTitle'
import { Button as CmsButton } from '@cmsgov/design-system'
import { Box, Divider, Grid } from '@mui/material'
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
import {
  CONFIRMATION_MESSAGE,
  ERROR_MESSAGES,
  STATUS_MESSAGES,
} from '@/constants'
import SdlSyncToggle from '@/components/SdlSyncToggle/SdlSyncToggle'

import ValidatedTextField from './ValidatedTextField'
import { emailValidator } from './validators'
import { EMPTY_SYSTEM } from './emptySystem'
import { datacenterenvironment } from './dataEnvironment'
import CircularProgress from '@mui/material/CircularProgress'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import _ from 'lodash'
import axiosInstance from '@/axiosConfig'
import { TEXTFIELD_HELPER_TEXT } from '@/constants'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { fetchOpDivs } from '@/utils/opdivs'
import type { OpDiv } from '@/types'
import { useContextProp } from '../Title/Context'
import { isUnscopedWriteAdmin } from '@/utils/userRoles'
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
  const { userInfo } = useContextProp()
  const hhsReadOnly = !isUnscopedWriteAdmin(userInfo)

  const [formValid, setFormValid] = React.useState<FormValidType>({
    issoemail: false,
    datacallcontact: false,
    fismaname: false,
    fismaacronym: false,
    datacenterenvironment: false,
    component: false,
    fismauid: false,
    opdiv_id: false,
  })
  const [opdivs, setOpDivs] = React.useState<OpDiv[]>([])
  const isFormValid = (): boolean => {
    return Object.values(formValid).every((value) => value === true)
  }
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
  const [reactivatedByName, setReactivatedByName] = React.useState<string>('')
  const [showReactivateForm, setShowReactivateForm] =
    React.useState<boolean>(false)
  const [reactivationNotes, setReactivationNotes] = React.useState<string>('')
  const [openReactivateAlert, setOpenReactivateAlert] =
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
      opdiv_id: TEXTFIELD_HELPER_TEXT,
    })
  React.useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetchOpDivs()
      .then(setOpDivs)
      .catch(() => {})
    return () => controller.abort()
  }, [open])

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
        opdiv_id: system?.opdiv_id != null ? true : false,
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
      setReactivationNotes('')
      setShowReactivateForm(false)
      setLoading(false)
    }
  }, [system, open])
  React.useEffect(() => {
    const controller = new AbortController()
    if (open && system?.decommissioned && system?.decommissioned_by) {
      const userId = system.decommissioned_by
      async function load() {
        try {
          const res = await axiosInstance.get(`users/${userId}`, {
            signal: controller.signal,
          })
          if (system?.decommissioned_by === userId) {
            setDecommissionedByName(res.data?.data?.fullname || userId)
          }
        } catch {
          if (controller.signal.aborted) return
          if (system?.decommissioned_by === userId) {
            setDecommissionedByName(userId)
          }
        }
      }
      load()
    } else {
      setDecommissionedByName('')
    }
    return () => {
      controller.abort()
    }
  }, [system, open])
  React.useEffect(() => {
    const controller = new AbortController()
    if (open && system?.reactivated_by) {
      const userId = system.reactivated_by
      async function load() {
        try {
          const res = await axiosInstance.get(`users/${userId}`, {
            signal: controller.signal,
          })
          if (system?.reactivated_by === userId) {
            setReactivatedByName(res.data?.data?.fullname || userId)
          }
        } catch {
          if (controller.signal.aborted) return
          if (system?.reactivated_by === userId) {
            setReactivatedByName(userId)
          }
        }
      }
      load()
    } else {
      setReactivatedByName('')
    }
    return () => {
      controller.abort()
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
      try {
        await axiosInstance.put(
          `fismasystems/${editedFismaSystem.fismasystemid}`,
          {
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
            sdl_sync_enabled: editedFismaSystem.sdl_sync_enabled ?? false,
            opdiv_id: editedFismaSystem.opdiv_id,
            isso_name: editedFismaSystem.isso_name,
            hva: editedFismaSystem.hva,
            fips: editedFismaSystem.fips,
            system_type: editedFismaSystem.system_type,
            cloud_system: editedFismaSystem.cloud_system,
            cloud_service_model: editedFismaSystem.cloud_service_model,
            cloud_vendor: editedFismaSystem.cloud_vendor,
            system_operator: editedFismaSystem.system_operator,
            goco_coco_gogo: editedFismaSystem.goco_coco_gogo,
            system_owner: editedFismaSystem.system_owner,
            system_owner_email: editedFismaSystem.system_owner_email,
            legacy: editedFismaSystem.legacy,
          }
        )
        notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
        onClose(editedFismaSystem)
      } catch (error) {
        if (isAuthHandled(error)) return
        const parsed = parseApiError(error)
        // Backend 400 with a field map: render each reason inline under
        // its input via formValid + formValidErrorText. The 'Not Saved'
        // toast is a status flag, not the detail.
        if (parsed.fieldErrors) {
          Object.entries(parsed.fieldErrors).forEach(([key, message]) => {
            setFormValid((prevState) => ({ ...prevState, [key]: false }))
            setFormValidErrorText((prevState) => ({
              ...prevState,
              [key]: message,
            }))
          })
          notify(STATUS_MESSAGES.notSaved, 'error', { autoHideDuration: 1500 })
          return
        }
        notify(parsed.message, 'error')
      }
    } else if (mode === 'create') {
      try {
        await axiosInstance.post(`fismasystems`, {
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
          sdl_sync_enabled: editedFismaSystem.sdl_sync_enabled ?? false,
          opdiv_id: editedFismaSystem.opdiv_id,
          isso_name: editedFismaSystem.isso_name,
          hva: editedFismaSystem.hva,
          fips: editedFismaSystem.fips,
          system_type: editedFismaSystem.system_type,
          cloud_system: editedFismaSystem.cloud_system,
          cloud_service_model: editedFismaSystem.cloud_service_model,
          cloud_vendor: editedFismaSystem.cloud_vendor,
          system_operator: editedFismaSystem.system_operator,
          goco_coco_gogo: editedFismaSystem.goco_coco_gogo,
          system_owner: editedFismaSystem.system_owner,
          system_owner_email: editedFismaSystem.system_owner_email,
          legacy: editedFismaSystem.legacy,
        })
        notify(STATUS_MESSAGES.created, 'success', { autoHideDuration: 1500 })
        onClose(editedFismaSystem)
      } catch (error) {
        if (isAuthHandled(error)) return
        const parsed = parseApiError(error)
        // Backend 400 with a field map: render each reason inline under
        // its input via formValid + formValidErrorText. The 'Not Created'
        // toast is a status flag, not the detail.
        if (parsed.fieldErrors) {
          Object.entries(parsed.fieldErrors).forEach(([key, message]) => {
            setFormValid((prevState) => ({ ...prevState, [key]: false }))
            setFormValidErrorText((prevState) => ({
              ...prevState,
              [key]: message,
            }))
          })
          notify(STATUS_MESSAGES.notCreated, 'error', {
            autoHideDuration: 1500,
          })
          return
        }
        notify(parsed.message, 'error')
      }
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
    try {
      const res = await axiosInstance.delete(
        `fismasystems/${editedFismaSystem.fismasystemid}`,
        { data: body }
      )
      if (res.status === 200 || res.status === 204) {
        notify(STATUS_MESSAGES.systemDecommissioned, 'success', {
          autoHideDuration: 2000,
        })
        const updatedSystem: FismaSystemType = res.data?.data || {
          ...editedFismaSystem,
          decommissioned: true,
          decommissioned_date: isoDate,
          decommissioned_notes: trimmedNotes || null,
        }
        onClose(updatedSystem)
      }
    } catch (error) {
      if (isAuthHandled(error)) return
      console.error(
        'Decommission error:',
        (error as { response?: { status?: number; data?: unknown } }).response
          ?.status,
        (error as { response?: { status?: number; data?: unknown } }).response
          ?.data
      )
      const parsed = parseApiError(error)
      if (parsed.status === 404) {
        notify(ERROR_MESSAGES.systemNotFound, 'error', {
          autoHideDuration: 2000,
        })
        return
      }
      notify(parsed.message, 'error')
    }
  }
  const handleReactivate = async () => {
    setOpenReactivateAlert(false)
    const trimmedNotes = reactivationNotes.trim()
    const body = trimmedNotes ? { notes: trimmedNotes } : undefined
    try {
      const res = await axiosInstance.put(
        `fismasystems/${editedFismaSystem.fismasystemid}/reactivate`,
        body
      )
      if (res.status === 200) {
        notify(STATUS_MESSAGES.systemReactivated, 'success', {
          autoHideDuration: 2000,
        })
        const updatedSystem: FismaSystemType = res.data?.data || {
          ...editedFismaSystem,
          decommissioned: false,
          reactivation_notes: trimmedNotes || null,
        }
        onClose(updatedSystem)
      }
    } catch (error) {
      if (isAuthHandled(error)) return
      console.error(
        'Reactivate error:',
        (error as { response?: { status?: number; data?: unknown } }).response
          ?.status,
        (error as { response?: { status?: number; data?: unknown } }).response
          ?.data
      )
      const parsed = parseApiError(error)
      if (parsed.status === 404) {
        notify(ERROR_MESSAGES.systemNotFound, 'error', {
          autoHideDuration: 2000,
        })
        return
      }
      notify(parsed.message, 'error')
    }
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
              <TextField
                id="opdiv_id"
                select
                required
                label="OpDiv"
                variant="standard"
                fullWidth
                value={editedFismaSystem.opdiv_id ?? ''}
                error={!formValid.opdiv_id}
                helperText={
                  !formValid.opdiv_id ? formValidErrorText.opdiv_id : ''
                }
                sx={{ mb: 2 }}
                onChange={(e) => {
                  const val =
                    e.target.value === '' ? null : Number(e.target.value)
                  setEditedFismaSystem((prev) => ({ ...prev, opdiv_id: val }))
                  setFormValid((prev) => ({ ...prev, opdiv_id: val != null }))
                }}
              >
                {opdivs.map((o) => (
                  <MenuItem key={o.opdiv_id} value={o.opdiv_id}>
                    {o.code} — {o.name}
                  </MenuItem>
                ))}
              </TextField>
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
                  <Box
                    sx={{
                      mt: 3,
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <SdlSyncToggle
                      checked={editedFismaSystem.sdl_sync_enabled ?? false}
                      onChange={(checked) =>
                        setEditedFismaSystem((prev) => ({
                          ...prev,
                          sdl_sync_enabled: checked,
                        }))
                      }
                    />
                  </Box>
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
                          {!showDecommissionForm && !showReactivateForm && (
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
                              {system?.reactivated_date && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display: 'block',
                                      fontStyle: 'italic',
                                      color: 'text.secondary',
                                    }}
                                  >
                                    Previously reactivated on{' '}
                                    {new Date(
                                      system.reactivated_date
                                    ).toLocaleDateString()}
                                    {system?.reactivated_by &&
                                      ` by ${reactivatedByName || system.reactivated_by}`}
                                    {system?.reactivation_notes
                                      ? ` (notes: ${system.reactivation_notes})`
                                      : ''}
                                  </Typography>
                                </Box>
                              )}
                              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
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
                                >
                                  Edit Decommission Details
                                </CmsButton>
                                <CmsButton
                                  variation="solid"
                                  size="small"
                                  onClick={() => {
                                    setReactivationNotes('')
                                    setShowReactivateForm(true)
                                  }}
                                >
                                  Reactivate System
                                </CmsButton>
                              </Box>
                            </>
                          )}
                          {showReactivateForm && (
                            <Box sx={{ ml: 2, mt: 2 }}>
                              <Typography
                                variant="body2"
                                sx={{ mt: 0, mb: 0.5, fontWeight: 500 }}
                              >
                                Reactivation Notes (optional)
                              </Typography>
                              <textarea
                                value={reactivationNotes}
                                maxLength={500}
                                rows={3}
                                onChange={(e) =>
                                  setReactivationNotes(e.target.value)
                                }
                                placeholder="Reason for reactivation..."
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
                                {reactivationNotes.length}/500
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <CmsButton
                                  variation="solid"
                                  size="small"
                                  onClick={() => setOpenReactivateAlert(true)}
                                >
                                  Reactivate
                                </CmsButton>
                                <CmsButton
                                  size="small"
                                  onClick={() => setShowReactivateForm(false)}
                                >
                                  Cancel
                                </CmsButton>
                              </Box>
                            </Box>
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
              <Divider sx={{ mt: 3, mb: 1 }} />
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, color: 'text.secondary' }}
              >
                HHS System Information
                {hhsReadOnly && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ ml: 1, color: 'text.secondary' }}
                  >
                    (read-only for OpDiv admins)
                  </Typography>
                )}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="ISSO Name"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.isso_name ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        isso_name: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="HVA"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.hva ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        hva: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="FIPS"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.fips ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        fips: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="System Type"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.system_type ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        system_type: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="Legacy"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.legacy ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        legacy: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="System Owner"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.system_owner ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        system_owner: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="System Owner Email"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    type="email"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.system_owner_email ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        system_owner_email: e.target.value || null,
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Cloud System"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.cloud_system ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        cloud_system: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="Cloud Service Model"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.cloud_service_model ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        cloud_service_model: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="Cloud Vendor"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.cloud_vendor ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        cloud_vendor: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="System Operator"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.system_operator ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        system_operator: e.target.value || null,
                      }))
                    }
                  />
                  <TextField
                    label="GoCo/CoCo/GoGo"
                    variant="standard"
                    fullWidth
                    margin="normal"
                    disabled={hhsReadOnly}
                    value={editedFismaSystem.goco_coco_gogo ?? ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        goco_coco_gogo: e.target.value || null,
                      }))
                    }
                  />
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
              : `Are you sure you want to decommission "${system?.fismaname}" on ${new Date(decommissionDate + 'T00:00:00.000Z').toLocaleDateString()}?${decommissionNotes.trim() ? ` Notes: "${decommissionNotes.trim().length > 100 ? decommissionNotes.trim().substring(0, 100) + '...' : decommissionNotes.trim()}"` : ''} This will hide the system from the active systems list. An admin can later reactivate the system if needed.`
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
        <ConfirmDialog
          title="Confirm Reactivate System"
          confirmationText={`Reactivate "${system?.fismaname}"? This will move the system back to the active systems list.${
            reactivationNotes.trim()
              ? ` Notes: "${reactivationNotes.trim().length > 100 ? reactivationNotes.trim().substring(0, 100) + '...' : reactivationNotes.trim()}"`
              : ''
          }`}
          open={openReactivateAlert}
          onClose={() => setOpenReactivateAlert(false)}
          confirmClick={(confirm: boolean) => {
            if (confirm) {
              handleReactivate()
            } else {
              setOpenReactivateAlert(false)
            }
          }}
        />
      </>
    )
  }
  return <></>
}
