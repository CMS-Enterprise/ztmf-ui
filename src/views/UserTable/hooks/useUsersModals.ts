import { useState } from 'react'
import type { GridRowId } from '@mui/x-data-grid'
import type { users } from '@/types'

/** A scoped-modal target: the user the modal acts on, plus their display name. */
interface ScopedModal {
  open: boolean
  userid: GridRowId
  userName: string
}

const CLOSED: ScopedModal = { open: false, userid: '', userName: '' }

/**
 * Per-row modal/dialog state for the Users table - groups the four flows
 * (Assign FISMA systems, Assign OpDivs, confirm delete, confirm restore)
 * into one hook so the parent reads a single object instead of threading
 * eight setters.
 *
 * Each scoped modal carries the target userid + display name together so
 * the parent never has to look up the row again to pass a confirmation
 * message. The confirm dialogs key off the pending row reference itself.
 * @returns {{
 *   assign: ScopedModal,
 *   opdiv: ScopedModal,
 *   pendingDelete: users | null,
 *   pendingRestore: users | null,
 *   openAssign: (row: users) => void,
 *   closeAssign: () => void,
 *   openOpDiv: (row: users) => void,
 *   closeOpDiv: () => void,
 *   askDelete: (row: users) => void,
 *   clearDelete: () => void,
 *   askRestore: (row: users) => void,
 *   clearRestore: () => void,
 * }} Modal state + a typed open/close action per flow.
 */
export function useUsersModals(): {
  assign: ScopedModal
  opdiv: ScopedModal
  pendingDelete: users | null
  pendingRestore: users | null
  openAssign: (row: users) => void
  closeAssign: () => void
  openOpDiv: (row: users) => void
  closeOpDiv: () => void
  askDelete: (row: users) => void
  clearDelete: () => void
  askRestore: (row: users) => void
  clearRestore: () => void
} {
  const [assign, setAssign] = useState<ScopedModal>(CLOSED)
  const [opdiv, setOpDiv] = useState<ScopedModal>(CLOSED)
  const [pendingDelete, setPendingDelete] = useState<users | null>(null)
  const [pendingRestore, setPendingRestore] = useState<users | null>(null)

  return {
    assign,
    opdiv,
    pendingDelete,
    pendingRestore,
    openAssign: (row) =>
      setAssign({
        open: true,
        userid: row.userid,
        userName: row.fullname ?? '',
      }),
    closeAssign: () => setAssign((s) => ({ ...s, open: false })),
    openOpDiv: (row) =>
      setOpDiv({
        open: true,
        userid: row.userid,
        userName: row.fullname ?? '',
      }),
    closeOpDiv: () => setOpDiv((s) => ({ ...s, open: false })),
    askDelete: (row) => setPendingDelete(row),
    clearDelete: () => setPendingDelete(null),
    askRestore: (row) => setPendingRestore(row),
    clearRestore: () => setPendingRestore(null),
  }
}
