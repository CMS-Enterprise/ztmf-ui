import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Box, CircularProgress, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import _ from 'lodash'

import { FismaSystemType, FormValidType, FormValidHelperText } from '@/types'
import { useContextProp } from '@/views/Title/Context'
import axiosInstance from '@/axiosConfig'
import { Routes } from '@/router/constants'
import {
  ERROR_MESSAGES,
  CONFIRMATION_MESSAGE,
  TEXTFIELD_HELPER_TEXT,
  INVALID_INPUT_TEXT,
} from '@/constants'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'

import SystemDetailHeader from './SystemDetailHeader'
import SystemDetailReadView from './SystemDetailReadView'
import SystemDetailEditView from './SystemDetailEditView'

export default function SystemDetailPage() {
  const { fismasystemid } = useParams<{ fismasystemid: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const { fismaSystems, setFismaSystems, userInfo } = useContextProp()

  const isAdmin = userInfo.role === 'ADMIN'
  const systemId = Number(fismasystemid)

  const system = useMemo(
    () => fismaSystems.find((s) => s.fismasystemid === systemId) ?? null,
    [fismaSystems, systemId]
  )

  // If system not in context (e.g. decommissioned and not in active-only fetch),
  // try fetching it individually so the page works on refresh
  const triedFetch = useRef(false)
  const [retryingFetch, setRetryingFetch] = useState(false)

  useEffect(() => {
    if (fismaSystems.length > 0 && !system && !triedFetch.current) {
      triedFetch.current = true
      setRetryingFetch(true)
      axiosInstance
        .get(`fismasystems/${systemId}`)
        .then((res) => {
          const data = res.data?.data
          if (data) {
            setFismaSystems((prev) => [...prev, data])
          }
        })
        .catch(() => {
          // System truly doesn't exist
        })
        .finally(() => setRetryingFetch(false))
    }
  }, [fismaSystems, system, systemId, setFismaSystems])

  const [isEditing, setIsEditing] = useState(false)
  const [editedSystem, setEditedSystem] = useState<FismaSystemType | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false)
  const [openDecommissionDialog, setOpenDecommissionDialog] = useState(false)

  // Decommission-specific state
  const [decommissionDate, setDecommissionDate] = useState('')
  const [decommissionDateError, setDecommissionDateError] = useState('')
  const [decommissionNotes, setDecommissionNotes] = useState('')
  const [showDecommissionForm, setShowDecommissionForm] = useState(false)
  const [decommissionedByName, setDecommissionedByName] = useState('')

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

  // Auto-enter edit mode from ?edit=true query param
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && isAdmin && system) {
      setIsEditing(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, isAdmin, system, setSearchParams])

  // Initialize editedSystem, form validity, and decommission defaults when entering edit mode
  useEffect(() => {
    if (isEditing && system) {
      setEditedSystem({ ...system })
      setFormValid({
        issoemail: (system.issoemail?.length ?? 0) > 0,
        datacallcontact: (system.datacallcontact?.length ?? 0) > 0,
        fismaname: (system.fismaname?.length ?? 0) > 0,
        fismaacronym: (system.fismaacronym?.length ?? 0) > 0,
        datacenterenvironment:
          (system.datacenterenvironment?.length ?? 0) > 0,
        component: (system.component?.length ?? 0) > 0,
        fismauid: (system.fismauid?.length ?? 0) > 0,
      })
      setDecommissionDate(getTodayISO())
      setDecommissionDateError('')
      setDecommissionNotes('')
      setShowDecommissionForm(false)
    }
  }, [isEditing, system])

  // Resolve decommissioned_by UUID to a human-readable name
  useEffect(() => {
    let cancelled = false
    if (system?.decommissioned && system?.decommissioned_by) {
      const userId = system.decommissioned_by
      axiosInstance
        .get(`users/${userId}`)
        .then((res) => {
          if (!cancelled && system?.decommissioned_by === userId) {
            setDecommissionedByName(res.data?.data?.fullname || userId)
          }
        })
        .catch(() => {
          if (!cancelled && system?.decommissioned_by === userId) {
            // User may have been removed — fall back to UUID
            setDecommissionedByName(userId)
          }
        })
    } else {
      setDecommissionedByName('')
    }
    return () => {
      cancelled = true
    }
  }, [system])

  const getTodayISO = (): string => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
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

    await axiosInstance
      .put(`fismasystems/${editedSystem.fismasystemid}`, {
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
      })
      .then(() => {
        enqueueSnackbar('Saved', {
          variant: 'success',
          anchorOrigin: { vertical: 'top', horizontal: 'left' },
          autoHideDuration: 1500,
        })
        setFismaSystems((prev) =>
          prev.map((s) =>
            s.fismasystemid === editedSystem.fismasystemid
              ? editedSystem
              : s
          )
        )
      })
      .catch((error) => {
        if (error.response?.status === 400) {
          const data: { [key: string]: string } = error.response.data.data
          Object.entries(data).forEach(([key]) => {
            setFormValid((prev) => ({ ...prev, [key]: false }))
            setFormValidErrorText((prev) => ({
              ...prev,
              [key]: INVALID_INPUT_TEXT(key),
            }))
          })
          enqueueSnackbar('Not Saved', {
            variant: 'error',
            anchorOrigin: { vertical: 'top', horizontal: 'left' },
            autoHideDuration: 1500,
          })
        } else {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: { message: ERROR_MESSAGES.error },
          })
        }
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  const handleDecommission = async () => {
    if (!editedSystem) return
    setOpenDecommissionDialog(false)

    if (!validateDecommissionDate(decommissionDate)) {
      return
    }
    const isoDate = new Date(
      decommissionDate + 'T00:00:00.000Z'
    ).toISOString()
    const trimmedNotes = decommissionNotes.trim()
    const body: { decommissioned_date: string; notes?: string } = {
      decommissioned_date: isoDate,
    }
    if (trimmedNotes) {
      body.notes = trimmedNotes
    }

    await axiosInstance
      .delete(`fismasystems/${editedSystem.fismasystemid}`, { data: body })
      .then((res) => {
        if (res.status === 200 || res.status === 204) {
          enqueueSnackbar('System decommissioned successfully', {
            variant: 'success',
            anchorOrigin: { vertical: 'top', horizontal: 'left' },
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
              s.fismasystemid === updatedSystem.fismasystemid
                ? updatedSystem
                : s
            )
          )
          setDecommissionedByName(userInfo.fullname || userInfo.userid)
          setIsEditing(false)
          setEditedSystem(null)
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
            anchorOrigin: { vertical: 'top', horizontal: 'left' },
            autoHideDuration: 2000,
          })
        } else if (error.response?.status === 404) {
          enqueueSnackbar('System not found', {
            variant: 'error',
            anchorOrigin: { vertical: 'top', horizontal: 'left' },
            autoHideDuration: 2000,
          })
        } else if (error.response?.status === 400) {
          const errorMsg = error.response?.data?.error || 'Invalid request'
          enqueueSnackbar(`Error: ${errorMsg}`, {
            variant: 'error',
            anchorOrigin: { vertical: 'top', horizontal: 'left' },
            autoHideDuration: 3000,
          })
        } else {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: { message: ERROR_MESSAGES.error },
          })
        }
      })
  }

  // Build decommission confirmation text
  const getDecommissionConfirmText = (): string => {
    const dateDisplay = new Date(
      decommissionDate + 'T00:00:00.000Z'
    ).toLocaleDateString()
    const notesSuffix = decommissionNotes.trim()
      ? ` Notes: "${decommissionNotes.trim().length > 100 ? decommissionNotes.trim().substring(0, 100) + '...' : decommissionNotes.trim()}"`
      : ''

    if (system?.decommissioned) {
      return `Update decommission details for "${system?.fismaname}" to ${dateDisplay}?${notesSuffix}`
    }
    return `Are you sure you want to decommission "${system?.fismaname}" on ${dateDisplay}?${notesSuffix} This will hide the system from the active systems list. This action cannot be undone through the UI.`
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
      <BreadCrumbs
        segmentLabels={{ [fismasystemid!]: system.fismaname }}
      />

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
          onInputChange={handleInputChange}
          onFieldChange={handleFieldChange}
          onValidatedFieldChange={handleValidatedFieldChange}
          onDecommissionDateChange={setDecommissionDate}
          onDecommissionNotesChange={setDecommissionNotes}
          onShowDecommissionForm={setShowDecommissionForm}
          onDecommissionRequest={() => setOpenDecommissionDialog(true)}
          validateDecommissionDate={validateDecommissionDate}
          getTodayISO={getTodayISO}
        />
      ) : (
        <SystemDetailReadView system={system} decommissionedByName={decommissionedByName} />
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
    </Box>
  )
}
