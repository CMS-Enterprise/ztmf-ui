import { useCallback, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import type { FismaSystemType } from '@/types'
import { ERROR_MESSAGES, STATUS_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { parseApiError } from '@/utils/apiErrors'

/**
 * Owns the reactivate sub-form state for the EditSystemModal:
 *
 *   - `reactivationNotes` - controlled notes textarea.
 *   - `showReactivateForm` - whether the sub-form is open.
 *   - `openReactivateAlert` - whether the "are you sure" ConfirmDialog
 *     is showing.
 *
 * `handleReactivate(system, onClose)` runs the PUT
 * /fismasystems/{id}/reactivate call, falls back to a 404 notice when the
 * row no longer exists, and on success calls `onClose(updatedSystem)`
 * with the backend's returned row or an optimistic merge. The system +
 * onClose are taken at call time so the hook does not have to track the
 * latest draft itself.
 *
 * `resetReactivateForm()` clears notes + closes the sub-form; called by
 * the modal's per-system init effect.
 * @returns {{
 *   reactivationNotes: string,
 *   setReactivationNotes: React.Dispatch<React.SetStateAction<string>>,
 *   showReactivateForm: boolean,
 *   setShowReactivateForm: React.Dispatch<React.SetStateAction<boolean>>,
 *   openReactivateAlert: boolean,
 *   setOpenReactivateAlert: React.Dispatch<React.SetStateAction<boolean>>,
 *   handleReactivate: (
 *     system: FismaSystemType,
 *     onClose: (updated: FismaSystemType) => void
 *   ) => Promise<void>,
 *   resetReactivateForm: () => void,
 * }} State + the async action + reset.
 */
export function useReactivateFlow() {
  const [reactivationNotes, setReactivationNotes] = useState<string>('')
  const [showReactivateForm, setShowReactivateForm] = useState<boolean>(false)
  const [openReactivateAlert, setOpenReactivateAlert] = useState<boolean>(false)

  const resetReactivateForm = useCallback(() => {
    setReactivationNotes('')
    setShowReactivateForm(false)
  }, [])

  const handleReactivate = useCallback(
    async (
      system: FismaSystemType,
      onClose: (updated: FismaSystemType) => void
    ) => {
      setOpenReactivateAlert(false)
      const trimmedNotes = reactivationNotes.trim()
      const body = trimmedNotes ? { notes: trimmedNotes } : undefined
      try {
        const res = await axiosInstance.put(
          `fismasystems/${system.fismasystemid}/reactivate`,
          body
        )
        if (res.status === 200) {
          notify(STATUS_MESSAGES.systemReactivated, 'success', {
            autoHideDuration: 2000,
          })
          const updatedSystem: FismaSystemType = res.data?.data || {
            ...system,
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
    },
    [reactivationNotes]
  )

  return {
    reactivationNotes,
    setReactivationNotes,
    showReactivateForm,
    setShowReactivateForm,
    openReactivateAlert,
    setOpenReactivateAlert,
    handleReactivate,
    resetReactivateForm,
  }
}
