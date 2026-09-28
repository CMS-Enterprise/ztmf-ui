import { useCallback, useState } from 'react'
import { STATUS_MESSAGES } from '@/constants'
import { parseApiError } from '@/utils/apiErrors'

/** Severity values supported by the in-table CustomSnackbar. */
export type SnackbarSeverity = 'success' | 'error' | 'warning' | 'info'

/**
 * In-table snackbar state for the Users view. The page uses a local
 * CustomSnackbar (rather than the global notistack `notify`) so save-flow
 * messages stack above the table without being clipped by the page layout.
 * This hook collapses the three useStates (open / text / severity) and
 * exposes the two common call-shapes the page needs:
 *
 *   - show(text, severity) for any direct message
 *   - showSaveError(error) for the API-error path, which prefers
 *     parseApiError's per-field message map when the backend returns one
 *     (e.g. a duplicate email on PUT /users/{id}).
 * @returns {{
 *   open: boolean,
 *   text: string,
 *   severity: SnackbarSeverity,
 *   show: (text: string, severity: SnackbarSeverity) => void,
 *   showSaveError: (error: unknown) => void,
 *   close: () => void,
 * }} Snackbar state + helpers for the parent view.
 */
export function useUsersSnackbar(): {
  open: boolean
  text: string
  severity: SnackbarSeverity
  show: (text: string, severity: SnackbarSeverity) => void
  showSaveError: (error: unknown) => void
  close: () => void
} {
  const [open, setOpen] = useState<boolean>(false)
  const [text, setText] = useState<string>(STATUS_MESSAGES.saved)
  const [severity, setSeverity] = useState<SnackbarSeverity>('success')

  const show = useCallback((message: string, kind: SnackbarSeverity) => {
    setText(message)
    setSeverity(kind)
    setOpen(true)
  }, [])

  const showSaveError = useCallback((error: unknown) => {
    // Surface the backend's specific reason on a failed save. On a 400 the
    // body carries a field -> message map (e.g. a duplicate email); join
    // those so the user sees what to fix rather than a generic retry
    // message.
    const parsed = parseApiError(error)
    const message = parsed.fieldErrors
      ? Object.values(parsed.fieldErrors).join(' ')
      : parsed.message
    setText(message)
    setSeverity('error')
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return { open, text, severity, show, showSaveError, close }
}
