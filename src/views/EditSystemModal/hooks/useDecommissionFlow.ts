import { useCallback, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import type { FismaSystemType } from '@/types'
import { ERROR_MESSAGES, STATUS_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { parseApiError } from '@/utils/apiErrors'
import { getTodayISO, validateDecommissionDate } from '../helpers'

/**
 * Owns the decommission sub-form state for the EditSystemModal:
 *
 *   - `decommissionDate` / `decommissionDateError` - controlled date
 *     input + the inline error string written by checkDecommissionDate.
 *   - `decommissionNotes` - controlled notes textarea.
 *   - `showDecommissionForm` - whether the sub-form is open.
 *   - `openDecommissionAlert` - whether the "are you sure" ConfirmDialog
 *     is showing.
 *
 * `checkDecommissionDate(dateStr)` wraps the pure validator and writes
 * the inline error string, returning a bool for the action handlers'
 * gating shape.
 *
 * `handleDecommission(system, onClose)` runs the DELETE /fismasystems/{id}
 * call, falls back to a 404 notice when the row has already been removed,
 * and on success calls `onClose(updatedSystem)` with either the backend's
 * returned row or an optimistic merge. The system + onClose are taken at
 * call time so the hook does not have to track the latest draft itself.
 *
 * `resetDecommissionForm()` clears every field to its open-time default;
 * called by the modal's per-system init effect.
 * @returns {{
 *   decommissionDate: string,
 *   setDecommissionDate: React.Dispatch<React.SetStateAction<string>>,
 *   decommissionDateError: string,
 *   setDecommissionDateError: React.Dispatch<React.SetStateAction<string>>,
 *   decommissionNotes: string,
 *   setDecommissionNotes: React.Dispatch<React.SetStateAction<string>>,
 *   showDecommissionForm: boolean,
 *   setShowDecommissionForm: React.Dispatch<React.SetStateAction<boolean>>,
 *   openDecommissionAlert: boolean,
 *   setOpenDecommissionAlert: React.Dispatch<React.SetStateAction<boolean>>,
 *   checkDecommissionDate: (dateStr: string) => boolean,
 *   handleDecommission: (
 *     system: FismaSystemType,
 *     onClose: (updated: FismaSystemType) => void
 *   ) => Promise<void>,
 *   resetDecommissionForm: () => void,
 * }} State + helpers + the async action.
 */
export function useDecommissionFlow() {
  const [decommissionDate, setDecommissionDate] = useState<string>('')
  const [decommissionDateError, setDecommissionDateError] = useState<string>('')
  const [decommissionNotes, setDecommissionNotes] = useState<string>('')
  const [showDecommissionForm, setShowDecommissionForm] =
    useState<boolean>(false)
  const [openDecommissionAlert, setOpenDecommissionAlert] =
    useState<boolean>(false)

  const checkDecommissionDate = useCallback((dateStr: string): boolean => {
    const { ok, error } = validateDecommissionDate(dateStr)
    setDecommissionDateError(error)
    return ok
  }, [])

  const resetDecommissionForm = useCallback(() => {
    setDecommissionDate(getTodayISO())
    setDecommissionDateError('')
    setDecommissionNotes('')
    setShowDecommissionForm(false)
  }, [])

  const handleDecommission = useCallback(
    async (
      system: FismaSystemType,
      onClose: (updated: FismaSystemType) => void
    ) => {
      setOpenDecommissionAlert(false)
      if (!checkDecommissionDate(decommissionDate)) return
      const isoDate = new Date(
        decommissionDate + 'T00:00:00.000Z'
      ).toISOString()
      const trimmedNotes = decommissionNotes.trim()
      const body: { decommissioned_date: string; notes?: string } = {
        decommissioned_date: isoDate,
      }
      if (trimmedNotes) body.notes = trimmedNotes
      try {
        const res = await axiosInstance.delete(
          `fismasystems/${system.fismasystemid}`,
          { data: body }
        )
        if (res.status === 200 || res.status === 204) {
          notify(STATUS_MESSAGES.systemDecommissioned, 'success', {
            autoHideDuration: 2000,
          })
          const updatedSystem: FismaSystemType = res.data?.data || {
            ...system,
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
    },
    [decommissionDate, decommissionNotes, checkDecommissionDate]
  )

  return {
    decommissionDate,
    setDecommissionDate,
    decommissionDateError,
    setDecommissionDateError,
    decommissionNotes,
    setDecommissionNotes,
    showDecommissionForm,
    setShowDecommissionForm,
    openDecommissionAlert,
    setOpenDecommissionAlert,
    checkDecommissionDate,
    handleDecommission,
    resetDecommissionForm,
  }
}
