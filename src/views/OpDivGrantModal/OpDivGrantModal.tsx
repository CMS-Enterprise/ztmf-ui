import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { GridRowId } from '@mui/x-data-grid'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { fetchUserOpDivs, grantOpDiv, revokeOpDiv } from '@/utils/userOpdivs'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import type { OpDiv } from '@/types'

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

type Props = {
  open: boolean
  handleClose: () => void
  userid: GridRowId
  userName: string
  /**
   * Assignable OpDivs, already scoped by the caller (children only, active,
   * and - for an OPDIV_ADMIN actor - limited to their own OpDivs). The modal
   * does not re-scope; it renders exactly what it is given.
   */
  opdivOptions: OpDiv[]
  /**
   * Fired after a confirmed grant or revoke so the caller can refresh the
   * user's row (grants + derived identity_provider) against post-mutation
   * server state.
   */
  onChanged?: (userid: string) => void
}

export default function OpDivGrantModal({
  open,
  handleClose,
  userid,
  userName,
  opdivOptions,
  onChanged,
}: Props) {
  const [assignedOpDivs, setAssignedOpDivs] = React.useState<number[]>([])
  const [pendingRevoke, setPendingRevoke] = React.useState<{
    opdivId: number
  } | null>(null)

  const opdivMap = React.useMemo(() => {
    const map: Record<number, { code: string; name: string }> = {}
    for (const od of opdivOptions) {
      map[od.opdiv_id] = { code: od.code, name: od.name }
    }
    return map
  }, [opdivOptions])

  const sortedOptionIds = React.useMemo(
    () =>
      opdivOptions
        .map((od) => od.opdiv_id)
        .sort((a, b) =>
          (opdivMap[a]?.code || '').localeCompare(opdivMap[b]?.code || '')
        ),
    [opdivOptions, opdivMap]
  )

  const handleError = (error: unknown) => {
    if (isAuthHandled(error)) return
    const parsed = parseApiError(error)
    notify(parsed.message, 'error')
  }

  React.useEffect(() => {
    if (open && userid) {
      fetchUserOpDivs(String(userid))
        .then((grants) => setAssignedOpDivs(grants))
        .catch((error) => handleError(error))
    }
  }, [open, userid])

  const handleConfirmRevoke = (confirm: boolean) => {
    const target = pendingRevoke
    setPendingRevoke(null)
    if (!confirm || !target) return
    revokeOpDiv(String(userid), target.opdivId)
      .then(() => {
        // Functional update so a grant that resolved while the confirm was
        // open is not dropped by a stale snapshot.
        setAssignedOpDivs((prev) => prev.filter((id) => id !== target.opdivId))
        notify('Saved - revoked OpDiv', 'success')
        onChanged?.(String(userid))
      })
      .catch((error) => handleError(error))
  }

  const optionLabel = (opdivId: number) => {
    const od = opdivMap[opdivId]
    return od ? `${od.code} - ${od.name}` : ''
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        aria-label="Assign OpDivs"
      >
        <DialogTitle align="center">
          <div>
            <Typography variant="h3">Assign OpDivs</Typography>
          </div>
        </DialogTitle>
        <DialogContent sx={{ height: 500 }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            limitTags={3}
            options={sortedOptionIds}
            disableClearable
            getOptionLabel={optionLabel}
            renderOption={(props, option, { selected }) => (
              <li {...props} key={option}>
                <Checkbox
                  icon={icon}
                  checkedIcon={checkedIcon}
                  style={{ marginRight: 8 }}
                  checked={selected}
                />
                {optionLabel(option)}
              </li>
            )}
            value={assignedOpDivs}
            onChange={(_event, newValue) => {
              const added = newValue.filter(
                (item) => !assignedOpDivs.includes(item)
              )
              const removed = assignedOpDivs.filter(
                (item) => !newValue.includes(item)
              )
              // Grant every added OpDiv and reflect only what the server
              // confirms - never trust the optimistic newValue wholesale.
              added.forEach((opdivId) => {
                grantOpDiv(String(userid), opdivId)
                  .then(() => {
                    setAssignedOpDivs((prev) =>
                      prev.includes(opdivId) ? prev : [...prev, opdivId]
                    )
                    notify('Saved - granted OpDiv', 'success')
                    onChanged?.(String(userid))
                  })
                  .catch((error) => handleError(error))
              })
              // Revocations confirm one at a time; the revoke handler computes
              // the next value functionally from the id being removed.
              if (removed.length) {
                setPendingRevoke({ opdivId: removed[0] })
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assign OpDivs"
                variant="filled"
                placeholder="OpDivs"
                InputLabelProps={{ sx: { marginTop: 0 } }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={handleClose}>Close</CmsButton>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        title="Confirm Revoke OpDiv"
        confirmationText={
          pendingRevoke
            ? `Are you sure you want to revoke ${
                optionLabel(pendingRevoke.opdivId) || 'this OpDiv'
              } from ${userName || 'this user'}?`
            : ''
        }
        open={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        confirmClick={handleConfirmRevoke}
        confirmLabel="Revoke"
      />
    </>
  )
}
