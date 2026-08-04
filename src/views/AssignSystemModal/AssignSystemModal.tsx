import React from 'react'
import {
  Box,
  Button,
  Checkbox,
  InputAdornment,
  OutlinedInput,
  Typography,
} from '@mui/material'
import Modal from '@/components/ui/Modal'
import { GridRowId } from '@mui/x-data-grid'
import axiosInstance from '@/axiosConfig'
import CustomSnackbar from '../Snackbar/Snackbar'
import SearchIcon from '@mui/icons-material/Search'
import { ERROR_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { colors } from '@/theme/tokens'
import { FismaSystemType } from '@/types'

type Props = {
  open: boolean
  handleClose: () => void
  userid: GridRowId
  userName: string
  // Global fisma-system metadata, fetched once by the parent (UserTable)
  // and passed down so opening the modal only costs the two per-user reads.
  // allSystems labels cross-OpDiv orphan assignments; decommSystems adds
  // the "(Decommissioned)" flag for retired-system chips.
  allSystems: FismaSystemType[]
  decommSystems: FismaSystemType[]
}

const searchInputSx = {
  height: 36,
  fontSize: 13,
  '& .MuiOutlinedInput-input': { padding: '0 0' },
  '& fieldset': { borderColor: colors.neutral200 },
}

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 1.25,
  py: 0.75,
  borderBottom: `1px solid ${colors.neutral100}`,
  cursor: 'pointer',
  '&:last-of-type': { borderBottom: 'none' },
  '&:hover': { backgroundColor: colors.neutral50 },
}

const rowTitleSx = {
  fontSize: 13,
  fontWeight: 700,
  color: colors.ink,
  lineHeight: 1.3,
}

const rowMetaSx = {
  fontSize: 12,
  color: colors.neutral500,
  lineHeight: 1.3,
}

/**
 * Assign FISMA systems modal. Renders the checkbox list described by the
 * mockup (frame 16) in the shared Modal shell. Checking a row POSTs the
 * assignment immediately, unchecking opens a confirm dialog before the
 * DELETE, and the footer Done button just closes - nothing is queued.
 *
 * The pickable set comes from GET /users/:id/assignablefismasystems, which
 * is already scoped to the target user's OpDivs (and intersected with the
 * caller's OpDivs when the caller is scoped). Current assignments outside
 * that set - cross-OpDiv orphans or decommissioned systems - still render,
 * labeled and subdued, so an admin can see and remove them; once unchecked
 * they leave the list and cannot be re-picked.
 */
export default function AssignSystemModal({
  open,
  handleClose,
  userid,
  userName,
  allSystems,
  decommSystems,
}: Props) {
  const [assignedSystems, setAssignedSystems] = React.useState<number[]>([])
  // Systems the target user is eligible to be assigned - already scoped
  // to their OpDivs (and intersected with the caller's OpDivs when the
  // caller is scoped) by GET /users/:id/assignablefismasystems. Drives
  // the pickable rows.
  const [assignable, setAssignable] = React.useState<FismaSystemType[]>([])
  const [openSnackBar, setOpenSnackBar] = React.useState<boolean>(false)
  const [pendingUnassign, setPendingUnassign] = React.useState<{
    systemid: number
    nextValue: number[]
  } | null>(null)
  const [search, setSearch] = React.useState<string>('')
  // Track the userid the current state belongs to so a same-user reopen
  // keeps rows visible (and just refreshes underneath) while opening for
  // a different user clears them BEFORE the new fetches land (no
  // previous-user row flash).
  const stateOwnerRef = React.useRef<GridRowId>('')
  React.useEffect(() => {
    if (!open || !userid) return
    if (stateOwnerRef.current !== userid) {
      setAssignedSystems([])
      setAssignable([])
      stateOwnerRef.current = userid
    }
    const controller = new AbortController()
    async function fetchPerUser() {
      // Two parallel reads. allSettled so an assignable-endpoint hiccup
      // doesn't blank the list for an admin trying to remove an
      // existing assignment.
      const [assignedRes, assignableRes] = await Promise.allSettled([
        axiosInstance.get<{ data: number[] | null }>(
          `/users/${userid}/assignedfismasystems`,
          { signal: controller.signal }
        ),
        axiosInstance.get<{ data: FismaSystemType[] | null }>(
          `/users/${userid}/assignablefismasystems`,
          { signal: controller.signal }
        ),
      ])
      if (controller.signal.aborted) return
      if (assignedRes.status === 'fulfilled') {
        setAssignedSystems(assignedRes.value.data.data ?? [])
      } else if (!isAuthHandled(assignedRes.reason)) {
        console.error('Error fetching assigned systems:', assignedRes.reason)
      }
      if (assignableRes.status === 'fulfilled') {
        setAssignable(assignableRes.value.data.data ?? [])
      } else if (!isAuthHandled(assignableRes.reason)) {
        console.error(
          'Error fetching assignable systems:',
          assignableRes.reason
        )
      }
    }
    fetchPerUser()
    return () => {
      controller.abort()
    }
  }, [open, userid])

  // Reset search when the modal closes so reopening it doesn't carry over
  // the previous filter for a different user.
  React.useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  // Label map merged from the three metadata sources. The server always
  // filters on the decommissioned flag, so the decommissioned list and
  // the two active lists (global + per-user assignable) never share an
  // id; later loops can't silently clear an earlier decommissioned flag.
  // Order therefore only settles label text, where the per-user
  // assignable response is the freshest and wins. Ids present only in
  // the global list are cross-OpDiv orphans - excluded from assignable
  // by design, but still needing a label so an admin can see what they
  // are unassigning.
  const systemMap = React.useMemo(() => {
    const map: Record<
      number,
      { name: string; acronym: string; decommissioned: boolean }
    > = {}
    const add = (s: FismaSystemType, decommissioned: boolean) => {
      map[s.fismasystemid] = {
        name: s.fismasubsystem
          ? s.fismaname + ' - ' + s.fismasubsystem
          : s.fismaname,
        acronym: s.fismaacronym,
        decommissioned,
      }
    }
    for (const s of decommSystems) add(s, true)
    for (const s of allSystems) add(s, false)
    for (const s of assignable) add(s, false)
    return map
  }, [decommSystems, allSystems, assignable])

  const assignableIds = React.useMemo(
    () => new Set(assignable.map((s) => s.fismasystemid)),
    [assignable]
  )

  // Rows = the assignable set plus any current assignments outside it
  // (cross-OpDiv orphans, decommissioned systems), so those stay visible
  // and removable. Sorted by acronym for scanability.
  const sortedSystemIds = React.useMemo(() => {
    const set = new Set<number>()
    for (const s of assignable) set.add(s.fismasystemid)
    for (const id of assignedSystems) set.add(id)
    return Array.from(set).sort((a, b) => {
      const acrA = systemMap[a]?.acronym || ''
      const acrB = systemMap[b]?.acronym || ''
      return acrA.localeCompare(acrB)
    })
  }, [assignable, assignedSystems, systemMap])

  // Substring filter on the raw acronym + name (not the decorated label),
  // so a clean acronym search is never coupled to display formatting.
  const filteredSystemIds = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return sortedSystemIds
    return sortedSystemIds.filter((id) => {
      const sys = systemMap[id]
      if (!sys) return false
      return (
        sys.name.toLowerCase().includes(needle) ||
        sys.acronym.toLowerCase().includes(needle)
      )
    })
  }, [sortedSystemIds, systemMap, search])

  /**
   * Display name for a row: acronym-decorated and suffixed for
   * decommissioned systems, with a legible fallback for an id missing
   * from every metadata source (parent fetch failed or system removed
   * mid-session) so the admin can still tell what they are unassigning.
   * @param {number} id - The fismasystemid to label.
   * @returns {string} The display label.
   */
  const labelFor = React.useCallback(
    (id: number): string => {
      const s = systemMap[id]
      if (!s) return `Unknown or decommissioned system (id ${id})`
      return s.decommissioned ? `${s.name} (Decommissioned)` : s.name
    },
    [systemMap]
  )

  const handleConfirmUnassign = async (confirm: boolean) => {
    const target = pendingUnassign
    setPendingUnassign(null)
    if (!confirm || !target) return
    try {
      await axiosInstance.delete(
        `/users/${userid}/assignedfismasystems/${target.systemid}`
      )
      setAssignedSystems(target.nextValue)
      notify('Saved - unassigned system', 'success')
    } catch (error) {
      if (isAuthHandled(error)) return
      notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 1500 })
    }
  }

  // Bulk-assign every currently visible (filtered) ASSIGNABLE system that
  // is not yet assigned. Out-of-scope leftovers in the list are display-only
  // and never bulk-assigned.
  const handleSelectAllInScope = async () => {
    const toAdd = filteredSystemIds.filter(
      (id) => assignableIds.has(id) && !assignedSystems.includes(id)
    )
    if (toAdd.length === 0) return
    const results = await Promise.allSettled(
      toAdd.map((id) =>
        axiosInstance.post(`/users/${userid}/assignedfismasystems`, {
          fismasystemid: id,
        })
      )
    )
    const succeeded = toAdd.filter((_, i) => results[i].status === 'fulfilled')
    if (succeeded.length > 0) {
      setAssignedSystems((prev) => Array.from(new Set([...prev, ...succeeded])))
      notify(
        `Saved - assigned ${succeeded.length} ${
          succeeded.length === 1 ? 'system' : 'systems'
        }`,
        'success'
      )
    }
    const failed = toAdd.length - succeeded.length
    if (failed > 0) {
      notify(
        `${failed} ${failed === 1 ? 'assignment' : 'assignments'} failed`,
        'error',
        { autoHideDuration: 2500 }
      )
    }
  }

  const handleToggle = async (systemId: number, checked: boolean) => {
    if (checked) {
      // Only assignable systems can be (re-)assigned; out-of-scope rows
      // exist purely so they can be unassigned.
      if (!assignableIds.has(systemId)) return
      try {
        await axiosInstance.post(`/users/${userid}/assignedfismasystems`, {
          fismasystemid: systemId,
        })
        setAssignedSystems((prev) =>
          prev.includes(systemId) ? prev : [...prev, systemId]
        )
        notify('Saved - assign system', 'success')
      } catch (error) {
        if (isAuthHandled(error)) return
        notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 1500 })
      }
    } else {
      setPendingUnassign({
        systemid: systemId,
        nextValue: assignedSystems.filter((id) => id !== systemId),
      })
    }
  }

  const selectedCount = assignedSystems.length
  const totalCount = sortedSystemIds.length

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Assign FISMA systems"
        eyebrow={userName || undefined}
        size="md"
        dense
        footer={
          <>
            <Button
              variant="text"
              color="primary"
              onClick={handleSelectAllInScope}
              disabled={filteredSystemIds.every(
                (id) => !assignableIds.has(id) || assignedSystems.includes(id)
              )}
              sx={{ mr: 'auto', textTransform: 'none', fontWeight: 600 }}
            >
              Select all in scope
            </Button>
            <Button variant="text" color="inherit" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleClose}>
              Save assignments
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
            Select the FISMA systems this user is responsible for.
          </Typography>

          <OutlinedInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or acronym"
            fullWidth
            sx={searchInputSx}
            startAdornment={
              <InputAdornment position="start" sx={{ ml: 1.25, mr: 1 }}>
                <SearchIcon sx={{ fontSize: 16, color: colors.neutral500 }} />
              </InputAdornment>
            }
            inputProps={{ 'aria-label': 'Search FISMA systems' }}
          />

          <Box
            sx={{
              border: `1px solid ${colors.neutral200}`,
              borderRadius: 1,
              maxHeight: 240,
              overflow: 'auto',
            }}
          >
            {filteredSystemIds.length === 0 ? (
              <Typography
                sx={{
                  fontSize: 13,
                  color: colors.neutral500,
                  textAlign: 'center',
                  py: 3,
                }}
              >
                No systems match your search.
              </Typography>
            ) : (
              filteredSystemIds.map((systemId) => {
                const system = systemMap[systemId]
                const isAssigned = assignedSystems.includes(systemId)
                // Decommissioned or cross-OpDiv leftovers render subdued:
                // present so they can be unassigned, visually "historical".
                const outOfScope =
                  !assignableIds.has(systemId) ||
                  system?.decommissioned === true
                return (
                  <Box
                    key={systemId}
                    component="label"
                    htmlFor={`assign-system-${systemId}`}
                    sx={{
                      ...rowSx,
                      ...(outOfScope && {
                        opacity: 0.65,
                        fontStyle: 'italic',
                      }),
                    }}
                  >
                    <Checkbox
                      id={`assign-system-${systemId}`}
                      checked={isAssigned}
                      // Out-of-scope rows only support unchecking.
                      disabled={!isAssigned && outOfScope}
                      onChange={(e) => handleToggle(systemId, e.target.checked)}
                      sx={{ p: 0.25 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={rowTitleSx}>
                        {labelFor(systemId)}
                      </Typography>
                      <Typography sx={rowMetaSx}>{system?.acronym}</Typography>
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>

          <Typography sx={{ fontSize: 12, color: colors.neutral500, mt: 0.5 }}>
            {selectedCount} of {totalCount}{' '}
            {totalCount === 1 ? 'system' : 'systems'} selected
          </Typography>
        </Box>
      </Modal>
      <CustomSnackbar
        open={openSnackBar}
        handleClose={() => setOpenSnackBar(false)}
        severity="success"
        duration={2000}
        text="Saved"
      />
      <ConfirmDialog
        title="Confirm Unassign System"
        confirmationText={
          pendingUnassign
            ? `Are you sure you want to unassign ${
                systemMap[pendingUnassign.systemid]?.acronym ?? 'this system'
              }${
                systemMap[pendingUnassign.systemid]
                  ? ` - ${systemMap[pendingUnassign.systemid].name}`
                  : ''
              } from ${userName || 'this user'}?`
            : ''
        }
        open={pendingUnassign !== null}
        onClose={() => setPendingUnassign(null)}
        confirmClick={handleConfirmUnassign}
      />
    </>
  )
}
