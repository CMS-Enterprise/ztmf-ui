import * as React from 'react'
import Modal from '@/components/ui/Modal'
import Field, { fieldInputSx } from '@/components/ui/Field'
import { Box, Button, Grid, OutlinedInput, Select } from '@mui/material'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import { editSystemModalProps } from '@/types'
import MenuItem from '@mui/material/MenuItem'
import { CONFIRMATION_MESSAGE, STATUS_MESSAGES } from '@/constants'
import SdlSyncToggle from '@/components/SdlSyncToggle/SdlSyncToggle'

import { emailValidator } from './validators'
import { EMPTY_SYSTEM } from './emptySystem'
import { datacenterenvironment } from './dataEnvironment'
import { useUserNameLookup } from './hooks/useUserNameLookup'
import { useEditSystemForm } from './hooks/useEditSystemForm'
import { useDecommissionFlow } from './hooks/useDecommissionFlow'
import { useReactivateFlow } from './hooks/useReactivateFlow'
import DecommissionedSystemInfo from './components/DecommissionedSystemInfo'
import DecommissionForm from './components/DecommissionForm'
import ReactivateForm from './components/ReactivateForm'
import CircularProgress from '@mui/material/CircularProgress'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import _ from 'lodash'
import axiosInstance from '@/axiosConfig'
import { TEXTFIELD_HELPER_TEXT } from '@/constants'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { colors } from '@/theme/tokens'

// Field shape (label + input + helper/error) lives in the shared
// ds/Field component so every form modal in the app renders identically.
// Use {@link fieldInputSx} for the input control to match the 38px height
// + 14px text + neutral-200 border used across the rest of the app.

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
  const {
    editedFismaSystem,
    setEditedFismaSystem,
    setFormValid,
    formValidErrorText,
    setFormValidErrorText,
    loading,
    isFormValid,
    showError,
    handleInputChange,
    markTouched,
    markFieldError,
  } = useEditSystemForm(system, open)
  const [openAlert, setOpenAlert] = React.useState<boolean>(false)
  const {
    decommissionDate,
    setDecommissionDate,
    decommissionDateError,
    decommissionNotes,
    setDecommissionNotes,
    showDecommissionForm,
    setShowDecommissionForm,
    openDecommissionAlert,
    setOpenDecommissionAlert,
    checkDecommissionDate,
    handleDecommission: runDecommission,
    resetDecommissionForm,
  } = useDecommissionFlow()
  const decommissionedByName = useUserNameLookup(
    system?.decommissioned_by,
    Boolean(open && system?.decommissioned && system?.decommissioned_by)
  )
  const reactivatedByName = useUserNameLookup(
    system?.reactivated_by,
    Boolean(open && system?.reactivated_by)
  )
  const {
    reactivationNotes,
    setReactivationNotes,
    showReactivateForm,
    setShowReactivateForm,
    openReactivateAlert,
    setOpenReactivateAlert,
    handleReactivate: runReactivate,
    resetReactivateForm,
  } = useReactivateFlow()
  const handleConfirmReturn = (confirm: boolean) => {
    if (confirm) {
      onClose(EMPTY_SYSTEM)
    }
  }
  // Reset the decommission + reactivate sub-form state every time a new
  // system loads. (Form-state init lives inside useEditSystemForm.)
  React.useEffect(() => {
    if (system && open) {
      resetDecommissionForm()
      resetReactivateForm()
    }
    // resetDecommissionForm / resetReactivateForm are stable (useCallback);
    // re-run only on system/open transitions, not on hook identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            markFieldError(key, message)
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
            markFieldError(key, message)
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
  const handleDecommission = () => runDecommission(editedFismaSystem, onClose)
  const handleReactivate = () => runReactivate(editedFismaSystem, onClose)
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
        <Modal
          open={open}
          onClose={handleClose}
          title={`${title} FISMA system`}
          eyebrow={mode === 'create' ? 'New system' : undefined}
          size="xl"
          disableBackdropClose
          footer={
            <>
              <Button variant="text" color="inherit" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={!isFormValid()}
              >
                {mode === 'edit' ? 'Save changes' : 'Create system'}
              </Button>
            </>
          }
        >
          <Box sx={{ flexGrow: 1 }} component="form">
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Field
                  id="fismaname"
                  label="Fisma Name"
                  required
                  error={
                    showError('fismaname')
                      ? formValidErrorText.fismaname
                      : undefined
                  }
                >
                  <OutlinedInput
                    id="fismaname"
                    fullWidth
                    value={editedFismaSystem.fismaname || ''}
                    error={showError('fismaname')}
                    onChange={(e) =>
                      handleInputChange(
                        e as React.ChangeEvent<HTMLInputElement>,
                        'fismaname'
                      )
                    }
                    sx={fieldInputSx}
                  />
                </Field>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Field
                      id="fismaacronym"
                      label="Fisma Acronym"
                      required
                      error={
                        showError('fismaacronym')
                          ? formValidErrorText.fismaacronym
                          : undefined
                      }
                    >
                      <OutlinedInput
                        id="fismaacronym"
                        fullWidth
                        value={editedFismaSystem.fismaacronym || ''}
                        error={showError('fismaacronym')}
                        onChange={(e) =>
                          handleInputChange(
                            e as React.ChangeEvent<HTMLInputElement>,
                            'fismaacronym'
                          )
                        }
                        sx={fieldInputSx}
                      />
                    </Field>
                  </Grid>
                  <Grid item xs={6}>
                    <Field id="groupacronym" label="Group Acronym">
                      <OutlinedInput
                        id="groupacronym"
                        fullWidth
                        value={editedFismaSystem.groupacronym || ''}
                        onChange={(e) =>
                          setEditedFismaSystem((prev) => ({
                            ...prev,
                            groupacronym: e.target.value,
                          }))
                        }
                        sx={fieldInputSx}
                      />
                    </Field>
                  </Grid>
                </Grid>

                <Field
                  id="component"
                  label="Component"
                  required
                  error={
                    showError('component')
                      ? formValidErrorText.component
                      : undefined
                  }
                >
                  <OutlinedInput
                    id="component"
                    fullWidth
                    value={editedFismaSystem.component || ''}
                    error={showError('component')}
                    onChange={(e) =>
                      handleInputChange(
                        e as React.ChangeEvent<HTMLInputElement>,
                        'component'
                      )
                    }
                    sx={fieldInputSx}
                  />
                </Field>

                <Field id="groupname" label="Group Name">
                  <OutlinedInput
                    id="groupname"
                    fullWidth
                    value={editedFismaSystem.groupname || ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        groupname: e.target.value,
                      }))
                    }
                    sx={fieldInputSx}
                  />
                </Field>

                <Field id="divisionname" label="Division Name">
                  <OutlinedInput
                    id="divisionname"
                    fullWidth
                    value={editedFismaSystem.divisionname || ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        divisionname: e.target.value,
                      }))
                    }
                    sx={fieldInputSx}
                  />
                </Field>

                <Field id="fismasubsystem" label="Fisma Subsystem">
                  <OutlinedInput
                    id="fismasubsystem"
                    fullWidth
                    value={editedFismaSystem.fismasubsystem || ''}
                    onChange={(e) =>
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        fismasubsystem: e.target.value,
                      }))
                    }
                    sx={fieldInputSx}
                  />
                </Field>
              </Grid>

              <Grid item xs={12} md={6}>
                <Field
                  id="datacallcontact"
                  label="Data Call Contact"
                  required
                  error={
                    showError('datacallcontact')
                      ? formValidErrorText.datacallcontact
                      : undefined
                  }
                >
                  <OutlinedInput
                    id="datacallcontact"
                    fullWidth
                    value={editedFismaSystem.datacallcontact || ''}
                    error={showError('datacallcontact')}
                    onChange={(e) => {
                      const value = e.target.value
                      const result = emailValidator(value)
                      const isValid = result === false
                      markTouched('datacallcontact')
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        datacallcontact: value,
                      }))
                      setFormValid((prev) => ({
                        ...prev,
                        datacallcontact: isValid,
                      }))
                      setFormValidErrorText((prev) => ({
                        ...prev,
                        datacallcontact: result || '',
                      }))
                    }}
                    sx={fieldInputSx}
                  />
                </Field>

                <Field
                  id="issoemail"
                  label="ISSO Email"
                  required
                  error={
                    showError('issoemail')
                      ? formValidErrorText.issoemail
                      : undefined
                  }
                >
                  <OutlinedInput
                    id="issoemail"
                    fullWidth
                    value={editedFismaSystem.issoemail || ''}
                    error={showError('issoemail')}
                    onChange={(e) => {
                      const value = e.target.value
                      const result = emailValidator(value)
                      const isValid = result === false
                      markTouched('issoemail')
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        issoemail: value,
                      }))
                      setFormValid((prev) => ({ ...prev, issoemail: isValid }))
                      setFormValidErrorText((prev) => ({
                        ...prev,
                        issoemail: result || '',
                      }))
                    }}
                    sx={fieldInputSx}
                  />
                </Field>

                <Field
                  id="fismauid"
                  label="Fisma UID"
                  error={
                    showError('fismauid')
                      ? formValidErrorText.fismauid
                      : undefined
                  }
                >
                  <OutlinedInput
                    id="fismauid"
                    fullWidth
                    value={editedFismaSystem.fismauid || ''}
                    error={showError('fismauid')}
                    onChange={(e) =>
                      handleInputChange(
                        e as React.ChangeEvent<HTMLInputElement>,
                        'fismauid'
                      )
                    }
                    sx={fieldInputSx}
                  />
                </Field>

                <Field
                  id="datacenterenvironment"
                  label="Datacenter Environment"
                  required
                  error={
                    showError('datacenterenvironment')
                      ? formValidErrorText.datacenterenvironment
                      : undefined
                  }
                >
                  <Select
                    id="datacenterenvironment"
                    fullWidth
                    value={editedFismaSystem.datacenterenvironment || ''}
                    error={showError('datacenterenvironment')}
                    onChange={(e) => {
                      const value = e.target.value as string
                      markTouched('datacenterenvironment')
                      setEditedFismaSystem((prev) => ({
                        ...prev,
                        datacenterenvironment: value,
                      }))
                      setFormValid((prev) => ({
                        ...prev,
                        datacenterenvironment: value.length > 0,
                      }))
                      if (value.length === 0) {
                        setFormValidErrorText((prev) => ({
                          ...prev,
                          datacenterenvironment: TEXTFIELD_HELPER_TEXT,
                        }))
                      }
                    }}
                    sx={{
                      height: 38,
                      fontSize: 14,
                      '& fieldset': { borderColor: colors.neutral200 },
                    }}
                  >
                    {datacenterenvironment.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Field>

                <Box
                  sx={{
                    mt: 3,
                    p: 2,
                    border: `1px solid ${colors.neutral200}`,
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
                          <DecommissionedSystemInfo
                            system={system}
                            decommissionedByName={decommissionedByName}
                            reactivatedByName={reactivatedByName}
                            onEditDecommission={() => {
                              if (system?.decommissioned_date) {
                                const d = new Date(system.decommissioned_date)
                                const yyyy = d.getFullYear()
                                const mm = String(d.getMonth() + 1).padStart(
                                  2,
                                  '0'
                                )
                                const dd = String(d.getDate()).padStart(2, '0')
                                setDecommissionDate(`${yyyy}-${mm}-${dd}`)
                              }
                              setDecommissionNotes(
                                system?.decommissioned_notes || ''
                              )
                              setShowDecommissionForm(true)
                            }}
                            onReactivate={() => {
                              setReactivationNotes('')
                              setShowReactivateForm(true)
                            }}
                          />
                        )}
                        {showReactivateForm && (
                          <ReactivateForm
                            notes={reactivationNotes}
                            setNotes={setReactivationNotes}
                            onConfirm={() => setOpenReactivateAlert(true)}
                            onCancel={() => setShowReactivateForm(false)}
                          />
                        )}
                        {showDecommissionForm && (
                          <DecommissionForm
                            date={decommissionDate}
                            setDate={setDecommissionDate}
                            dateError={decommissionDateError}
                            checkDate={checkDecommissionDate}
                            notes={decommissionNotes}
                            setNotes={setDecommissionNotes}
                            onConfirm={() => setOpenDecommissionAlert(true)}
                            onCancel={() => setShowDecommissionForm(false)}
                            confirmLabel="Update"
                            marginLeft={2}
                          />
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
                          <DecommissionForm
                            date={decommissionDate}
                            setDate={setDecommissionDate}
                            dateError={decommissionDateError}
                            checkDate={checkDecommissionDate}
                            notes={decommissionNotes}
                            setNotes={setDecommissionNotes}
                            onConfirm={() => setOpenDecommissionAlert(true)}
                            confirmLabel="Decommission"
                            confirmColor="error"
                            marginLeft={4}
                          />
                        )}
                      </>
                    )}
                  </Box>
                )}
              </Grid>
            </Grid>
          </Box>
        </Modal>
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
