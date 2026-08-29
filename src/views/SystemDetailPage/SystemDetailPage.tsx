import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import _ from 'lodash'

import {
  FismaSystemType,
  FormValidType,
  FormValidHelperText,
  ScoreAggregate,
} from '@/types'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
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
import PageHeader from '@/components/ui/PageHeader'
import DatacallContextCard from '@/components/DatacallContextCard/DatacallContextCard'
import { StatusChip, CodeBadge } from '@/components/ui/StatusChip'
import { getTodayISO, truncateNotes } from '@/utils/decommission'
import {
  isAdmin as checkIsAdmin,
  isSystemScoped,
  isSystemDelegate,
  isISSO,
  hasSystemAccess,
} from '@/utils/userRoles'

import SystemDetailReadView from './SystemDetailReadView'
import SystemDetailEditView from './SystemDetailEditView'
import TargetMaturityCard from './TargetMaturityCard'
import { EXTENDED_METADATA_KEYS } from './fieldConfig'
import {
  buildExtendedDiff,
  crossFieldClears,
} from '@/utils/systemMetadataVocab'
import SystemDelegatesSection from './SystemDelegatesSection'

export default function SystemDetailPage() {
  const { fismasystemid } = useParams<{ fismasystemid: string }>()
  const {
    fismaSystems,
    setFismaSystems,
    userInfo,
    selectedDatacall,
    latestDataCallId,
    datacalls,
    datacenterEnvironments,
    fetchFismaSystems,
    showDecommissioned,
    opdivs,
  } = useContextProp()

  const isAdmin = checkIsAdmin(userInfo)
  const systemId = fismasystemid ? Number(fismasystemid) : NaN
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  // Target maturity is the one field pair an assigned ISSO may write; the
  // TargetMaturityCard owns its own edit/save lifecycle and this flag only
  // gates the Edit affordance on that card. The page-level Edit button
  // below stays admin-only because the system form is admin-only. The
  // backend re-checks assignment/OpDiv scope on the target-maturity PUT.
  const canEditTarget = isAdmin || isSystemScoped(userInfo)

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

  // Score aggregates across every datacall for this system. Used to render the
  // overall score, the pillar snapshot, and the trend line in the score hero.
  // Mirrors the PillarScoresPage call (include_pillars=true).
  const [scores, setScores] = useState<ScoreAggregate[]>([])
  useEffect(() => {
    if (!systemId) return
    const controller = new AbortController()
    async function fetchScores() {
      try {
        const res = await axiosInstance.get(
          `/scores/aggregate?fismasystemid=${systemId}&include_pillars=true`,
          { signal: controller.signal }
        )
        setScores(res.data?.data ?? [])
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Failed to load system scores', error)
      }
    }
    fetchScores()
    return () => {
      controller.abort()
    }
  }, [systemId])

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

  // Only the fields required to edit gate the save; keep aligned with the
  // required fields in fieldConfig.ts. component, datacallcontact, and issoemail
  // are absent so a blank stored value cannot freeze an unrelated edit.
  const [formValid, setFormValid] = useState<FormValidType>({
    fismaname: false,
    fismaacronym: false,
    datacenterenvironment: false,
    fismauid: false,
  })

  const [formValidErrorText, setFormValidErrorText] =
    useState<FormValidHelperText>({
      fismaname: TEXTFIELD_HELPER_TEXT,
      fismaacronym: TEXTFIELD_HELPER_TEXT,
      datacenterenvironment: TEXTFIELD_HELPER_TEXT,
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
        fismaname: (system.fismaname?.length ?? 0) > 0,
        fismaacronym: (system.fismaacronym?.length ?? 0) > 0,
        datacenterenvironment: (system.datacenterenvironment?.length ?? 0) > 0,
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

  const isFormValid = (): boolean =>
    Object.values(formValid).every((v) => v === true)

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

  const handleFieldChange = (
    key: string,
    value: string | boolean | string[] | null
  ) => {
    setEditedSystem((prev) =>
      prev ? { ...prev, [key]: value, ...crossFieldClears(key, value) } : prev
    )
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

  // Called by TargetMaturityCard after its own save succeeds. Overlays the
  // two target fields onto the system in fismaSystems so the read view
  // reflects the change without a refetch. Target maturity lives on its own
  // endpoint, so the page-level Save below never touches these fields.
  const handleTargetMaturitySaved = (saved: FismaSystemType) => {
    setFismaSystems((prev) =>
      prev.map((s) =>
        s.fismasystemid !== saved.fismasystemid
          ? s
          : {
              ...s,
              target_maturity_tier: saved.target_maturity_tier,
              target_maturity_justification:
                saved.target_maturity_justification,
            }
      )
    )
  }

  const handleSave = async () => {
    if (!editedSystem) return
    // The extended-metadata payload is a diff against the loaded system, and
    // buildExtendedDiff treats a missing baseline as "every field is unset",
    // which sends all of them. editedSystem outlives the system it was seeded
    // from, so saving without a baseline would persist values the user never
    // touched, including an ISSO name the backend derived rather than stored.
    // Refuse the save rather than writing a payload built from no baseline.
    if (!system) {
      notify(STATUS_MESSAGES.notSaved, 'error', { autoHideDuration: 1500 })
      return
    }
    setIsSaving(true)
    try {
      // Full-system PUT. The page-level Edit button is gated on isAdmin,
      // so this handler is unreachable for non-admins.
      const putBody: Record<string, unknown> = {
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
      }
      // Extended metadata: send only the fields the user changed. The backend
      // reads an omitted field as "leave unchanged" and a per-type clear signal
      // (enum '', boolean null, array []) as "clear".
      Object.assign(
        putBody,
        buildExtendedDiff(editedSystem, system, EXTENDED_METADATA_KEYS)
      )
      await axiosInstance.put(
        `fismasystems/${editedSystem.fismasystemid}`,
        putBody
      )

      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      // Refetch rather than echoing the local draft into state. The PUT returns
      // no body, and the saved value of a field the backend resolves is not the
      // value that was sent: clearing isso_name stores NULL, and the list read
      // then resolves the name from the ISSO's user record. Echoing the draft
      // would show the cleared field as empty until the next fetch.
      //
      // The caller's decommissioned view mode is preserved so saving does not
      // change which systems the dashboard lists. That mode can exclude the
      // system just saved, so clearing triedFetch lets the single-system
      // fallback re-add it.
      triedFetch.current = false
      await fetchFismaSystems(showDecommissioned)
    } catch (error) {
      if (isAuthHandled(error)) return
      const parsed = parseApiError(error)
      // Backend 400 with a field map: render each reason inline under its
      // input via formValid + formValidErrorText. The 'Not Saved' toast
      // is a status flag, not the detail. Only keys the system form owns are
      // routed inline; target-maturity field errors fall through to the toast
      // (they're client-validated, so a 400 here is unexpected).
      const knownFieldErrors = Object.entries(parsed.fieldErrors ?? {}).filter(
        ([key]) => key in formValid
      )
      if (knownFieldErrors.length > 0) {
        knownFieldErrors.forEach(([key, message]) => {
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

  // Pick the score aggregate matching the currently-selected datacall; fall
  // back to the newest scored call so the page still shows the most recent
  // measurement when no datacall is picked. "Newest" and "previous" are
  // deadline order via the shared datacalls list, not raw datacallid -
  // historical loads can out-id the real current call (#393).
  const scoredCallsByDeadline = sortDatacallsByDeadline(
    datacalls.filter((dc) => scores.some((s) => s.datacallid === dc.datacallid))
  )
  const currentScore =
    scores.find((s) => s.datacallid === activeDataCallId) ??
    scores.find((s) => s.datacallid === scoredCallsByDeadline[0]?.datacallid) ??
    scores[0]
  const currentScoredIdx = currentScore
    ? scoredCallsByDeadline.findIndex(
        (dc) => dc.datacallid === currentScore.datacallid
      )
    : -1
  const previousScore =
    currentScoredIdx >= 0
      ? scores.find(
          (s) =>
            s.datacallid ===
            scoredCallsByDeadline[currentScoredIdx + 1]?.datacallid
        )
      : undefined
  const datacallNameById = (id?: number) =>
    id ? datacalls.find((dc) => dc.datacallid === id)?.datacall : undefined
  const systemOpDiv = opdivs.find((o) => o.opdiv_id === system.opdiv_id)
  const opdivCode = systemOpDiv?.code
  const opdivName = systemOpDiv?.name ?? null

  // Delegates section: visible to any assigned non-delegate (incl. ISSM) when
  // the system's OpDiv has the capability enabled; hidden from delegates.
  // Managing (add/invite/remove/renew) is ISSO + admin only - ISSM sees the
  // roster read-only (the backend would 404 an ISSM write). The toggle read
  // comes from the already-fetched opdivs list.
  const canViewDelegates =
    hasSystemAccess(userInfo) &&
    !isSystemDelegate(userInfo) &&
    !!systemOpDiv?.system_delegate_enabled
  const canManageDelegates = isAdmin || isISSO(userInfo)

  // Target maturity owns its own edit/save lifecycle (see TargetMaturityCard).
  // The card is slotted into the right column of whichever view renders
  // (between Data Lake Export and Organization). The card's Edit button is
  // hidden while the page is in Edit mode so an admin can't run both
  // edit flows at once: saving the card mid-page-edit would fire the
  // isEditing/system useEffect and reset editedSystem, wiping any
  // in-progress page-form edits.
  const targetMaturityCard = (
    <TargetMaturityCard
      system={system}
      canEdit={canEditTarget && !isEditing}
      onSaved={handleTargetMaturitySaved}
    />
  )

  // Header actions vary by mode: View questionnaire + Edit system in read,
  // Cancel + Save in edit. Edit gates on admin and on not being mid-save.
  const headerActions = isEditing ? (
    <>
      <Button
        variant="outlined"
        color="primary"
        onClick={handleCancel}
        disabled={isSaving}
      >
        Cancel
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={handleSave}
        disabled={!isFormValid() || isSaving}
      >
        {isSaving ? 'Saving...' : 'Save changes'}
      </Button>
    </>
  ) : (
    <>
      <Button
        variant="outlined"
        color="primary"
        // A real router link rather than onClick + navigate, so open-in-new-
        // tab and copy-link work (ui#640). Same-tab clicks still carry the
        // system id via route state; a new tab resolves it from the acronym
        // in the URL (the questionnaire's deep-link path).
        component={RouterLink}
        to={`/questionnaire/${system.fismaacronym.toLowerCase()}`}
        state={{ fismasystemid: system.fismasystemid }}
      >
        View questionnaire
      </Button>
      {isAdmin && (
        <Button variant="contained" color="primary" onClick={handleEdit}>
          Edit system
        </Button>
      )}
    </>
  )

  return (
    <Box sx={{ py: 4 }}>
      <PageHeader
        breadcrumbs={
          <BreadCrumbs segmentLabels={{ [fismasystemid!]: system.fismaname }} />
        }
        // Edit mode reframes the page identity: H1 reads "Edit system" with
        // a plain "<name> · <acronym>" subtitle so the user knows which
        // system they are editing. Read mode keeps the system name as the
        // h1 with the inline Active/Decommissioned chip.
        title={
          isEditing ? (
            'Edit system'
          ) : (
            <Box
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}
            >
              {system.fismaname}
              <StatusChip
                label={system.decommissioned ? 'Decommissioned' : 'Active'}
                kind={system.decommissioned ? 'neutral' : 'active'}
              />
            </Box>
          )
        }
        subtitle={
          isEditing ? (
            <Box
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
            >
              {system.fismaname}
              {system.fismaacronym && (
                <>
                  <span aria-hidden>·</span>
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {system.fismaacronym}
                  </Box>
                </>
              )}
            </Box>
          ) : (
            <Box
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
            >
              {system.fismauid && <CodeBadge code={system.fismauid} />}
              {opdivCode && (
                <>
                  <span aria-hidden>·</span>
                  <CodeBadge code={opdivCode} />
                </>
              )}
            </Box>
          )
        }
        actions={headerActions}
      />

      {/* Edit mode locks the datacall picker: system metadata (acronym,
          datacenter env, etc.) is not datacall-scoped, so switching the
          datacall mid-edit would do nothing and confuse the user. The card
          still renders so the user knows which datacall context they're in,
          just static. */}
      <DatacallContextCard readOnly={isEditing} />

      {isEditing && editedSystem && isAdmin ? (
        <SystemDetailEditView
          system={system}
          editedSystem={editedSystem}
          formValid={formValid}
          formValidErrorText={formValidErrorText}
          datacenterEnvironments={datacenterEnvironments}
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
          targetMaturitySlot={targetMaturityCard}
          opdivName={opdivName}
        />
      ) : (
        <SystemDetailReadView
          system={system}
          opdivs={opdivs}
          currentScore={currentScore}
          previousScore={previousScore}
          previousDatacallName={datacallNameById(previousScore?.datacallid)}
          decommissionedByName={decommissionedByName}
          targetMaturitySlot={targetMaturityCard}
          opdivName={opdivName}
        />
      )}

      {canViewDelegates && (
        <Box sx={{ mt: 4 }}>
          <SystemDelegatesSection
            system={system}
            canManage={canManageDelegates}
          />
        </Box>
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
