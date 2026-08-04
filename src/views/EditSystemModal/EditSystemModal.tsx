import * as React from 'react'
import Modal from '@/components/ui/Modal'
import { Box, Button } from '@mui/material'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import { editSystemModalProps } from '@/types'
import { CONFIRMATION_MESSAGE, STATUS_MESSAGES } from '@/constants'

import { EMPTY_SYSTEM } from './emptySystem'
import { useUserNameLookup } from './hooks/useUserNameLookup'
import { useEditSystemForm } from './hooks/useEditSystemForm'
import { useDecommissionFlow } from './hooks/useDecommissionFlow'
import { useReactivateFlow } from './hooks/useReactivateFlow'
import DecommissionedSystemInfo from './components/DecommissionedSystemInfo'
import DecommissionForm from './components/DecommissionForm'
import ReactivateForm from './components/ReactivateForm'
import SystemFormFields from './components/SystemFormFields'
import ExtendedMetadataFields from './components/ExtendedMetadataFields'
import { toDropdownOptionsWithCurrent } from '@/utils/dataCenterEnvironments'
import CircularProgress from '@mui/material/CircularProgress'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import _ from 'lodash'
import axiosInstance from '@/axiosConfig'
import { fetchOpDivs } from '@/utils/opdivs'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { EXTENDED_METADATA_KEYS } from '@/views/SystemDetailPage/fieldConfig'
import { buildExtendedDiff } from '@/utils/systemMetadataVocab'
import type { FismaSystemType, OpDiv } from '@/types'

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
  datacenterEnvironments = [],
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
  const datacenterEnvironmentOptions = toDropdownOptionsWithCurrent(
    datacenterEnvironments,
    system?.datacenterenvironment
  )
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
  // Options for the required owning-OpDiv selector, loaded on open so the
  // list is always current (an admin may have created an OpDiv since the
  // last open). Failures surface: an empty list leaves Save stuck.
  const [opdivs, setOpDivs] = React.useState<OpDiv[]>([])
  React.useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetchOpDivs(false, controller.signal)
      .then(setOpDivs)
      .catch((error) => {
        // Ignore the abort fired by cleanup on close; surface real failures
        // so an empty OpDiv list (which leaves Save stuck) isn't silent.
        if (controller.signal.aborted || isAuthHandled(error)) return
        const parsed = parseApiError(error)
        notify(
          parsed.message || 'Failed to load the OpDiv list. Please try again.',
          'error'
        )
      })
    return () => controller.abort()
  }, [open])
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
        const editBody: Record<string, unknown> = {
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
        }
        // Extended metadata: dirty-diff. Omitted = leave unchanged; a field's
        // per-type clear signal (enum '', boolean null, array []) = clear. Send
        // only the fields the user changed from the loaded system.
        Object.assign(
          editBody,
          buildExtendedDiff(editedFismaSystem, system, EXTENDED_METADATA_KEYS)
        )
        await axiosInstance.put(
          `fismasystems/${editedFismaSystem.fismasystemid}`,
          editBody
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
        const body: Record<string, unknown> = {
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
        }
        // Create: no prior system, so send only the extended fields the user
        // actually set (diff against the empty baseline).
        Object.assign(
          body,
          buildExtendedDiff(
            editedFismaSystem,
            EMPTY_SYSTEM as FismaSystemType,
            EXTENDED_METADATA_KEYS
          )
        )
        await axiosInstance.post(`fismasystems`, body)
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
            <SystemFormFields
              editedFismaSystem={editedFismaSystem}
              setEditedFismaSystem={setEditedFismaSystem}
              handleInputChange={handleInputChange}
              showError={showError}
              formValidErrorText={formValidErrorText}
              markTouched={markTouched}
              setFormValid={setFormValid}
              setFormValidErrorText={setFormValidErrorText}
              opdivs={opdivs}
              datacenterEnvironmentOptions={datacenterEnvironmentOptions}
            >
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
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
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
            </SystemFormFields>
            <ExtendedMetadataFields
              editedFismaSystem={editedFismaSystem}
              setEditedFismaSystem={setEditedFismaSystem}
              mode={mode}
            />
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
