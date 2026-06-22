import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Box, CircularProgress, Divider, Typography } from '@mui/material'
import _ from 'lodash'

import { FismaSystemType, FormValidType, FormValidHelperText } from '@/types'
import { useContextProp } from '@/views/Title/Context'
import axiosInstance from '@/axiosConfig'
import {
  CONFIRMATION_MESSAGE,
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  TEXTFIELD_HELPER_TEXT,
} from '@/constants'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import { getTodayISO, truncateNotes } from '@/utils/decommission'
import { isAdmin as checkIsAdmin } from '@/utils/userRoles'

import SystemDetailHeader from './SystemDetailHeader'
import SystemDetailReadView from './SystemDetailReadView'
import SystemDetailEditView from './SystemDetailEditView'
import CfactsRecordCard from './CfactsRecordCard'

export default function SystemDetailPage() {
  const { fismasystemid } = useParams<{ fismasystemid: string }>()
  const { fismaSystems, setFismaSystems, userInfo } = useContextProp()

  const isAdmin = checkIsAdmin(userInfo)
  const systemId = fismasystemid ? Number(fismasystemid) : NaN

  const system = useMemo(
    () => fismaSystems.find((s) => s.fismasystemid === systemId) ?? null,
    [fismaSystems, systemId]
  )

  // If system not in context (e.g. decommissioned and not in active-only fetch),
  // try fetching it individually so the page works on refresh
  const triedFetch = useRef(false)
  const [retryingFetch, setRetryingFetch] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    if (fismaSystems.length > 0 && !system && !triedFetch.current) {
      triedFetch.current = true
      setRetryingFetch(true)
      async function load() {
        try {
          const res = await axiosInstance.get(`fismasystems/${systemId}`, {
            signal: controller.signal,
          })
          const data = res.data?.data
          if (data) {
            setFismaSystems((prev) => [...prev, data])
          }
        } catch {
          if (controller.signal.aborted) return
          // System truly doesn't exist
        } finally {
          if (!controller.signal.aborted) setRetryingFetch(false)
        }
      }
      load()
    }
    return () => {
      controller.abort()
    }
  }, [fismaSystems, system, systemId, setFismaSystems])

  const [isEditing, setIsEditing] = useState(false)
  const [editedSystem, setEditedSystem] = useState<FismaSystemType | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false)
  const [openDecommissionDialog, setOpenDecommissionDialog] = useState(false)
  const [openReactivateDialog, setOpenReactivateDialog] = useState(false)

  // Decommission-specific state
  const [decommissionDate, setDecommissionDate] = useState('')
  const [decommissionDateError, setDecommissionDateError] = useState('')
  const [decommissionNotes, setDecommissionNotes] = useState('')
  const [showDecommissionForm, setShowDecommissionForm] = useState(false)
  const [decommissionedByName, setDecommissionedByName] = useState('')

  // Reactivate-specific state
  const [reactivationNotes, setReactivationNotes] = useState('')
  const [showReactivateForm, setShowReactivateForm] = useState(false)
  const [reactivatedByName, setReactivatedByName] = useState('')

  const [formValid, setFormValid] = useState<FormValidType>({
    issoemail: false,
    datacallcontact: false,
    fismaname: false,
    fismaacronym: false,
    datacenterenvironment: false,
    component: false,
    fismauid: false,
  })

  const [formValidErrorText, setFormValidErrorText] =
    useState<FormValidHelperText>({
      issoemail: TEXTFIELD_HELPER_TEXT,
      datacallcontact: TEXTFIELD_HELPER_TEXT,
      fismaname: TEXTFIELD_HELPER_TEXT,
      fismaacronym: TEXTFIELD_HELPER_TEXT,
      datacenterenvironment: TEXTFIELD_HELPER_TEXT,
      component: TEXTFIELD_HELPER_TEXT,
      fismauid: TEXTFIELD_HELPER_TEXT,
    })

  // Initialize editedSystem, form validity, and decommission defaults when entering edit mode
  useEffect(() => {
    if (isEditing && system) {
      setEditedSystem({
        ...system,
        sdl_sync_enabled: system.sdl_sync_enabled ?? false,
      })
      setFormValid({
        issoemail: (system.issoemail?.length ?? 0) > 0,
        datacallcontact: (system.datacallcontact?.length ?? 0) > 0,
        fismaname: (system.fismaname?.length ?? 0) > 0,
        fismaacronym: (system.fismaacronym?.length ?? 0) > 0,
        datacenterenvironment: (system.datacenterenvironment?.length ?? 0) > 0,
        component: (system.component?.length ?? 0) > 0,
        fismauid: (system.fismauid?.length ?? 0) > 0,
      })
      setDecommissionDate(getTodayISO())
      setDecommissionDateError('')
      setDecommissionNotes('')
      setShowDecommissionForm(false)
      setReactivationNotes('')
      setShowReactivateForm(false)
    }
  }, [isEditing, system])

  // Resolve decommissioned_by UUID to a human-readable name
  useEffect(() => {
    const controller = new AbortController()
    if (system?.decommissioned && system?.decommissioned_by) {
      const userId = system.decommissioned_by
      async function load() {
        try {
          const res = await axiosInstance.get(`users/${userId}`, {
            signal: controller.signal,
          })
          setDecommissionedByName(res.data?.data?.fullname || userId)
        } catch {
          if (controller.signal.aborted) return
          // User may have been removed — fall back to UUID
          setDecommissionedByName(userId)
        }
      }
      load()
    } else {
      setDecommissionedByName('')
    }
    return () => {
      controller.abort()
    }
  }, [system])

  // Resolve reactivated_by UUID to a human-readable name
  useEffect(() => {
    const controller = new AbortController()
    if (system?.reactivated_by) {
      const userId = system.reactivated_by
      async function load() {
        try {
          const res = await axiosInstance.get(`users/${userId}`, {
            signal: controller.signal,
          })
          setReactivatedByName(res.data?.data?.fullname || userId)
        } catch {
          if (controller.signal.aborted) return
          setReactivatedByName(userId)
        }
      }
      load()
    } else {
      setReactivatedByName('')
    }
    return () => {
      controller.abort()
    }
  }, [system])

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
    today.setUTCHours(0, 0, 0, 0)
    if (parsed > today) {
      setDecommissionDateError('Date cannot be in the future')
      return false
    }
    setDecommissionDateError('')
    return true
  }

  const isFormValid = (): boolean => {
    return Object.values(formValid).every((v) => v === true)
  }

  const hasUnsavedChanges = (): boolean => {
    if (!editedSystem || !system) return false
    return !_.isEqual(system, editedSystem)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setOpenConfirmDialog(true)
    } else {
      setIsEditing(false)
      setEditedSystem(null)
    }
  }

  const handleConfirmReturn = (confirm: boolean) => {
    if (confirm) {
      setIsEditing(false)
      setEditedSystem(null)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    key: string
  ) => {
    const value = e.target.value
    const isValid = value.length > 0
    setEditedSystem((prev) => (prev ? { ...prev, [key]: value } : prev))
    setFormValid((prev) => ({ ...prev, [key]: isValid }))
    if (!isValid) {
      setFormValidErrorText((prev) => ({
        ...prev,
        [key]: TEXTFIELD_HELPER_TEXT,
      }))
    }
  }

  const handleFieldChange = (key: string, value: string) => {
    setEditedSystem((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleValidatedFieldChange = (
    key: string,
    isValid: boolean,
    value: string
  ) => {
    setFormValid((prev) => ({ ...prev, [key]: isValid }))
    if (isValid) {
      setEditedSystem((prev) => (prev ? { ...prev, [key]: value } : prev))
    }
  }

  const handleSave = async () => {
    if (!editedSystem) return
    setIsSaving(true)
    try {
      await axiosInstance.put(`fismasystems/${editedSystem.fismasystemid}`, {
        fismauid: editedSystem.fismauid,
        fismaacronym: editedSystem.fismaacronym,
        fismaname: editedSystem.fismaname,
        fismasubsystem: editedSystem.fismasubsystem,
        component: editedSystem.component,
        groupacronym: editedSystem.groupacronym,
        groupname: editedSystem.groupname,
        divisionname: editedSystem.divisionname,
        datacenterenvironment: editedSystem.datacenterenvironment,
        datacallcontact: editedSystem.datacallcontact,
        issoemail: editedSystem.issoemail,
        sdl_sync_enabled: editedSystem.sdl_sync_enabled,
      })
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      setFismaSystems((prev) =>
        prev.map((s) =>
          s.fismasystemid === editedSystem.fismasystemid ? editedSystem : s
        )
      )
    } catch (error) {
      if (isAuthHandled(error)) return
      const parsed = parseApiError(error)
      // Backend 400 with a field map: render each reason inline under its
      // input via formValid + formValidErrorText. The 'Not Saved' toast
      // is a status flag, not the detail.
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors).forEach(([key, message]) => {
          setFormValid((prev) => ({ ...prev, [key]: false }))
          setFormValidErrorText((prev) => ({ ...prev, [key]: message }))
        })
        notify(STATUS_MESSAGES.notSaved, 'error', { autoHideDuration: 1500 })
        return
      }
      if (parsed.status === 404) {
        notify(ERROR_MESSAGES.systemNotFound, 'error', {
          autoHideDuration: 2000,
        })
        return
      }
      notify(parsed.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDecommission = async () => {
    if (!editedSystem) return
    setOpenDecommissionDialog(false)

    if (!validateDecommissionDate(decommissionDate)) {
      return
    }
    const isoDate = new Date(decommissionDate + 'T00:00:00.000Z').toISOString()
    const trimmedNotes = decommissionNotes.trim()
    const body: { decommissioned_date: string; notes?: string } = {
      decommissioned_date: isoDate,
    }
    if (trimmedNotes) {
      body.notes = trimmedNotes
    }

    try {
      const res = await axiosInstance.delete(
        `fismasystems/${editedSystem.fismasystemid}`,
        { data: body }
      )
      if (res.status === 200 || res.status === 204) {
        notify(STATUS_MESSAGES.systemDecommissioned, 'success', {
          autoHideDuration: 2000,
        })
        const updatedSystem: FismaSystemType = res.data?.data || {
          ...editedSystem,
          decommissioned: true,
          decommissioned_date: isoDate,
          decommissioned_by: userInfo.userid,
          decommissioned_notes: trimmedNotes || null,
        }
        setFismaSystems((prev) =>
          prev.map((s) =>
            s.fismasystemid === updatedSystem.fismasystemid ? updatedSystem : s
          )
        )
        setDecommissionedByName(userInfo.fullname || userInfo.userid)
        setIsEditing(false)
        setEditedSystem(null)
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
    if (!editedSystem) return
    setOpenReactivateDialog(false)

    const trimmedNotes = reactivationNotes.trim()
    const body = trimmedNotes ? { notes: trimmedNotes } : undefined

    try {
      const res = await axiosInstance.put(
        `fismasystems/${editedSystem.fismasystemid}/reactivate`,
        body
      )
      if (res.status === 200) {
        notify(STATUS_MESSAGES.systemReactivated, 'success', {
          autoHideDuration: 2000,
        })
        const updatedSystem: FismaSystemType = res.data?.data || {
          ...editedSystem,
          decommissioned: false,
          reactivated_by: userInfo.userid,
          reactivated_date: new Date().toISOString(),
          reactivation_notes: trimmedNotes || null,
        }
        setFismaSystems((prev) =>
          prev.map((s) =>
            s.fismasystemid === updatedSystem.fismasystemid ? updatedSystem : s
          )
        )
        setReactivatedByName(userInfo.fullname || userInfo.userid)
        setIsEditing(false)
        setEditedSystem(null)
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

  // Build decommission confirmation text
  const getDecommissionConfirmText = (): string => {
    const dateDisplay = new Date(
      decommissionDate + 'T00:00:00.000Z'
    ).toLocaleDateString()
    const truncated = truncateNotes(decommissionNotes)
    const notesSuffix = truncated ? ` Notes: "${truncated}"` : ''

    if (system?.decommissioned) {
      return `Update decommission details for "${system?.fismaname}" to ${dateDisplay}?${notesSuffix}`
    }
    return `Are you sure you want to decommission "${system?.fismaname}" on ${dateDisplay}?${notesSuffix} This will hide the system from the active systems list. An admin can later reactivate the system if needed.`
  }

  const getReactivateConfirmText = (): string => {
    const truncated = truncateNotes(reactivationNotes)
    const notesSuffix = truncated ? ` Notes: "${truncated}"` : ''
    return `Reactivate "${system?.fismaname}"? This will move the system back to the active systems list.${notesSuffix}`
  }

  // Invalid system ID in URL
  if (isNaN(systemId)) {
    return (
      <Box sx={{ mt: 4 }}>
        <BreadCrumbs segmentLabels={{ [fismasystemid ?? '']: 'Invalid' }} />
        <Typography variant="h5" color="error" sx={{ mt: 2 }}>
          Invalid system ID
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          &ldquo;{fismasystemid}&rdquo; is not a valid system ID.
        </Typography>
      </Box>
    )
  }

  // Loading state: context hasn't populated yet, or retrying fetch for individual system
  if (fismaSystems.length === 0 || retryingFetch) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        <CircularProgress size={60} />
      </Box>
    )
  }

  // System not found
  if (!system) {
    return (
      <Box sx={{ mt: 4 }}>
        <BreadCrumbs segmentLabels={{ [fismasystemid!]: 'Not Found' }} />
        <Typography variant="h5" color="error" sx={{ mt: 2 }}>
          System not found
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          No system with ID &ldquo;{fismasystemid}&rdquo; was found.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 1, mb: 4 }}>
      <BreadCrumbs segmentLabels={{ [fismasystemid!]: system.fismaname }} />

      <SystemDetailHeader
        systemName={system.fismaname}
        isAdmin={isAdmin}
        isEditing={isEditing}
        isSaving={isSaving}
        isFormValid={isFormValid()}
        onEdit={handleEdit}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {isEditing && editedSystem ? (
        <SystemDetailEditView
          system={system}
          editedSystem={editedSystem}
          formValid={formValid}
          formValidErrorText={formValidErrorText}
          decommissionDate={decommissionDate}
          decommissionDateError={decommissionDateError}
          decommissionNotes={decommissionNotes}
          showDecommissionForm={showDecommissionForm}
          decommissionedByName={decommissionedByName}
          reactivationNotes={reactivationNotes}
          showReactivateForm={showReactivateForm}
          reactivatedByName={reactivatedByName}
          onInputChange={handleInputChange}
          onFieldChange={handleFieldChange}
          onValidatedFieldChange={handleValidatedFieldChange}
          onDecommissionDateChange={setDecommissionDate}
          onDecommissionNotesChange={setDecommissionNotes}
          onShowDecommissionForm={setShowDecommissionForm}
          onDecommissionRequest={() => setOpenDecommissionDialog(true)}
          onReactivationNotesChange={setReactivationNotes}
          onShowReactivateForm={setShowReactivateForm}
          onReactivateRequest={() => setOpenReactivateDialog(true)}
          validateDecommissionDate={validateDecommissionDate}
          onSdlSyncToggle={(checked) =>
            setEditedSystem((prev) =>
              prev ? { ...prev, sdl_sync_enabled: checked } : prev
            )
          }
        />
      ) : (
        <SystemDetailReadView
          system={system}
          decommissionedByName={decommissionedByName}
        />
      )}

      {/* ZTMF Insights enrichment is CMS-only for now; gate the whole section on
          the per-system sdl_sync_enabled toggle (default false for new OpDivs). */}
      {system.fismauid && system.sdl_sync_enabled && (
        <>
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" sx={{ mb: 2 }}>
            ZTMF Insights
          </Typography>
          <CfactsRecordCard fismaUid={system.fismauid} />
        </>
      )}

      <ConfirmDialog
        confirmationText={CONFIRMATION_MESSAGE}
        open={openConfirmDialog}
        onClose={() => setOpenConfirmDialog(false)}
        confirmClick={handleConfirmReturn}
      />
      <ConfirmDialog
        title={
          system.decommissioned
            ? 'Update Decommission Details'
            : 'Confirm Decommission'
        }
        confirmationText={getDecommissionConfirmText()}
        open={openDecommissionDialog}
        onClose={() => setOpenDecommissionDialog(false)}
        confirmClick={(confirm: boolean) => {
          if (confirm) {
            handleDecommission()
          } else {
            setOpenDecommissionDialog(false)
          }
        }}
      />
      <ConfirmDialog
        title="Confirm Reactivate System"
        confirmationText={getReactivateConfirmText()}
        open={openReactivateDialog}
        onClose={() => setOpenReactivateDialog(false)}
        confirmClick={(confirm: boolean) => {
          if (confirm) {
            handleReactivate()
          } else {
            setOpenReactivateDialog(false)
          }
        }}
      />
    </Box>
  )
}
