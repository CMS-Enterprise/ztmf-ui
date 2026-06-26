import React from 'react'
import {
  Box,
  Button,
  Checkbox,
  InputAdornment,
  OutlinedInput,
  Typography,
} from '@mui/material'
import Modal from '@/components/ds/Modal'
import { GridRowId } from '@mui/x-data-grid'
import axiosInstance from '@/axiosConfig'
import CustomSnackbar from '../Snackbar/Snackbar'
import SearchIcon from '@mui/icons-material/Search'
import { ERROR_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { colors } from '@/theme/tokens'

type Props = {
  fismaSystemMap: Record<number, { name: string; acronym: string }>
  open: boolean
  handleClose: () => void
  userid: GridRowId
  userName: string
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
 * mockup (frame 16) in the shared Modal shell, replacing the legacy
 * SideDrawer + Autocomplete. Behavior is unchanged: checking a row POSTs
 * the assignment immediately, unchecking opens a confirm dialog before
 * the DELETE, and the footer Done button just closes - nothing is queued.
 */
export default function AssignSystemModal({
  fismaSystemMap,
  open,
  handleClose,
  userid,
  userName,
}: Props) {
  const [assignedSystems, setAssignedSystems] = React.useState<number[]>([])
  const [openSnackBar, setOpenSnackBar] = React.useState<boolean>(false)
  const [pendingUnassign, setPendingUnassign] = React.useState<{
    systemid: number
    nextValue: number[]
  } | null>(null)
  const [search, setSearch] = React.useState<string>('')

  React.useEffect(() => {
    if (!open || !userid) return
    const controller = new AbortController()
    async function fetchAssigned() {
      try {
        const res = await axiosInstance.get(
          `/users/${userid}/assignedfismasystems`,
          { signal: controller.signal }
        )
        setAssignedSystems(res.data.data || [])
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Error fetching assigned systems:', error)
      }
    }
    fetchAssigned()
    return () => {
      controller.abort()
    }
  }, [open, userid])

  // Reset search when the modal closes so reopening it doesn't carry over
  // the previous filter for a different user.
  React.useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const sortedSystemIds = React.useMemo(
    () =>
      Object.keys(fismaSystemMap)
        .map(Number)
        .sort((a, b) => {
          const acrA = fismaSystemMap[a]?.acronym || ''
          const acrB = fismaSystemMap[b]?.acronym || ''
          return acrA.localeCompare(acrB)
        }),
    [fismaSystemMap]
  )

  const filteredSystemIds = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return sortedSystemIds
    return sortedSystemIds.filter((id) => {
      const sys = fismaSystemMap[id]
      if (!sys) return false
      return (
        sys.name.toLowerCase().includes(needle) ||
        sys.acronym.toLowerCase().includes(needle)
      )
    })
  }, [sortedSystemIds, fismaSystemMap, search])

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

  // Bulk-assign every currently visible (filtered) system that is not yet
  // assigned. "In scope" = whatever the search filter leaves; this mirrors
  // the mockup's framing ("they're responsible for in REBEL and SCNDRL")
  // by letting an admin narrow scope via the search box first.
  const handleSelectAllInScope = async () => {
    const toAdd = filteredSystemIds.filter(
      (id) => !assignedSystems.includes(id)
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
              disabled={filteredSystemIds.every((id) =>
                assignedSystems.includes(id)
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
            placeholder="Search by name or FISMA ID"
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
                const system = fismaSystemMap[systemId]
                const isAssigned = assignedSystems.includes(systemId)
                return (
                  <Box
                    key={systemId}
                    component="label"
                    htmlFor={`assign-system-${systemId}`}
                    sx={rowSx}
                  >
                    <Checkbox
                      id={`assign-system-${systemId}`}
                      checked={isAssigned}
                      onChange={(e) => handleToggle(systemId, e.target.checked)}
                      sx={{ p: 0.25 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={rowTitleSx}>{system?.name}</Typography>
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
                fismaSystemMap[pendingUnassign.systemid]?.acronym ??
                'this system'
              }${
                fismaSystemMap[pendingUnassign.systemid]
                  ? ` - ${fismaSystemMap[pendingUnassign.systemid].name}`
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
