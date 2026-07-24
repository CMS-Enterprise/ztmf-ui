import React from 'react'
import {
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { GridRowId } from '@mui/x-data-grid'
import axiosInstance from '@/axiosConfig'
import CustomSnackbar from '../Snackbar/Snackbar'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import { ERROR_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { FismaSystemType } from '@/types'
const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

type FismaSystemEntry = {
  name: string
  acronym: string
  decommissioned: boolean
}

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
  // the dropdown filter.
  const [assignable, setAssignable] = React.useState<FismaSystemType[]>([])
  const [openSnackBar, setOpenSnackBar] = React.useState<boolean>(false)
  const [pendingUnassign, setPendingUnassign] = React.useState<{
    systemid: number
    nextValue: number[]
  } | null>(null)
  // Substring filter that matches on the raw acronym + name rather than the
  // display label. `labelFor` decorates the label ("(Decommissioned)" suffix,
  // "Unknown or decommissioned system (id X)" fallback), so filtering off the
  // label would couple search to that formatting. Wrapped below to also strip
  // decommissioned entries from the dropdown (they still surface as chips for
  // existing assignments but are not selectable for new ones). MUI defaults
  // (ignoreCase: true, matchFrom: 'any') give case-insensitive substring match.
  const optionFilter = React.useMemo(
    () =>
      createFilterOptions<number>({
        stringify: (option) => {
          const system = fismaSystemMap[option]
          if (!system) return String(option)
          return `${system.acronym} ${system.name}`
        },
      }),
    [fismaSystemMap]
  )
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
      // doesn't blank the chip area for an admin trying to remove an
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

  // Composed label, shared by getOptionLabel and renderTags so a chip and
  // its dropdown row never disagree. Decommissioned entries get the
  // "(Decommissioned)" suffix. An id missing from all three sources still
  // gets an identifiable label rather than an empty one - that happens
  // when the parent's global fetch failed or a system was removed
  // mid-session, and a blank chip would leave the admin unable to tell
  // what they are about to unassign.
  const labelFor = React.useCallback(
    (option: number): string => {
      const s = systemMap[option]
      if (!s) return `Unknown or decommissioned system (id ${option})`
      const base = `${s.acronym} - ${s.name}`
      return s.decommissioned ? `${base} (Decommissioned)` : base
    },
    [systemMap]
  )

  // Union of assignable + currently-assigned ids so MUI's value-vs-
  // options reconciliation matches every chip (no "None of the options
  // match" warning). filterOptions below narrows the DROPDOWN back to
  // the assignable set so out-of-scope orphans are not re-selectable.
  const optionIds = React.useMemo(() => {
    const set = new Set<number>()
    for (const s of assignable) set.add(s.fismasystemid)
    for (const id of assignedSystems) set.add(id)
    return Array.from(set)
  }, [assignable, assignedSystems])

  const assignableIds = React.useMemo(
    () => new Set(assignable.map((s) => s.fismasystemid)),
    [assignable]
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

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle align="center">
          <div>
            <Typography variant="h3">Assign Fisma Systems</Typography>
          </div>
        </DialogTitle>
        <DialogContent sx={{ height: 500 }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            limitTags={2}
            options={optionIds.slice().sort((a: number, b: number) => {
              const acrA = systemMap[a]?.acronym || ''
              const acrB = systemMap[b]?.acronym || ''
              return acrA.localeCompare(acrB)
            })}
            disableClearable
            getOptionLabel={(option: number) => labelFor(option)}
            // Narrow the DROPDOWN to the assignable set. Options stays
            // broad so chips for out-of-scope current assignments still
            // resolve; only the picker is scoped.
            filterOptions={(options, params) =>
              optionFilter(options, params).filter(
                (o) => !fismaSystemMap[o]?.decommissioned
              )
            }
            renderOption={(props, option, { selected }) => {
              const isAssigned = assignedSystems.includes(option)
              return (
                <li {...props}>
                  <Checkbox
                    icon={icon}
                    key={option}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected || isAssigned}
                    disabled={isAssigned}
                  />
                  {systemMap[option]?.acronym}
                  {' - '}
                  {systemMap[option]?.name}
                </li>
              )
            }}
            // Custom chip render so decommissioned assignments get a
            // subdued visual (reduced opacity + italics) that reads as
            // "this is historical, not active", while remaining deletable
            // so an admin can still unassign the user from it.
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const isDecommissioned =
                  systemMap[option]?.decommissioned === true
                return (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={labelFor(option)}
                    sx={
                      isDecommissioned
                        ? { opacity: 0.65, fontStyle: 'italic' }
                        : undefined
                    }
                  />
                )
              })
            }
            value={assignedSystems}
            onChange={async (_event, newValue) => {
              const added = newValue.filter(
                (item) => !assignedSystems.includes(item)
              )
              const removed = assignedSystems.filter(
                (item) => !newValue.includes(item)
              )
              if (added.length) {
                try {
                  await axiosInstance.post(
                    `/users/${userid}/assignedfismasystems`,
                    { fismasystemid: added[0] }
                  )
                  setAssignedSystems(newValue)
                  notify('Saved - assign system', 'success')
                } catch (error) {
                  if (isAuthHandled(error)) return
                  notify(ERROR_MESSAGES.tryAgain, 'error', {
                    autoHideDuration: 1500,
                  })
                }
              } else if (removed.length) {
                setPendingUnassign({
                  systemid: removed[0],
                  nextValue: newValue,
                })
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assign FISMA Systems"
                variant="filled"
                placeholder="FISMA Systems"
                InputLabelProps={{
                  sx: {
                    marginTop: 0, // Remove the margin top of the label
                  },
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={handleClose}>Close</CmsButton>
        </DialogActions>
      </Dialog>
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
