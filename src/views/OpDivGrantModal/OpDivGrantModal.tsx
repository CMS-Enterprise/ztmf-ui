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
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import { fetchUserOpDivs, setUserOpDivs } from '@/utils/userOpdivs'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import type { OpDiv } from '@/types'

type Props = {
  open: boolean
  handleClose: () => void
  userid: GridRowId
  userName: string
  /**
   * Assignable OpDivs, already scoped by the caller (children only, active,
   * and - for an OPDIV_ADMIN actor - limited to their own OpDivs). The modal
   * does not re-scope; it renders exactly what it is given. Drives the dropdown.
   */
  opdivOptions: OpDiv[]
  /**
   * Full label source (all OpDivs, incl. parent/inactive), keyed by opdiv_id.
   * Separate from opdivOptions so a grant to a non-assignable OpDiv still
   * resolves to a readable chip instead of a blank one. Ids missing here fall
   * back to "OpDiv #{id}".
   */
  opdivLabelMap: Record<number, { code: string; name: string }>
  /**
   * True when the caller is scope-limited (an OPDIV_ADMIN): the save must drop
   * grants outside the assignable set, since the backend rejects a desired set
   * containing an ID the caller doesn't hold. False for unscoped admins
   * (OWNER/HHS_ADMIN), whose save must PRESERVE the target's out-of-scope
   * grants - omitting them reads as a revocation.
   */
  enforceCallerScope: boolean
  /**
   * Fired after a successful save so the caller can refresh the user's row
   * (grants + derived identity_provider) against post-mutation server state.
   */
  onChanged?: (userid: string) => void
}

export default function OpDivGrantModal({
  open,
  handleClose,
  userid,
  userName,
  opdivOptions,
  opdivLabelMap,
  enforceCallerScope,
  onChanged,
}: Props) {
  const [localOpDivs, setLocalOpDivs] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [fetchFailed, setFetchFailed] = React.useState(false)

  // The assignable set drives the dropdown and gates a scoped caller's save.
  const assignableIds = React.useMemo(
    () => new Set(opdivOptions.map((od) => od.opdiv_id)),
    [opdivOptions]
  )

  // Label from the full map (assignable or not), with an identifiable fallback
  // so a grant to an OpDiv missing from the map never chips blank.
  const optionLabel = React.useCallback(
    (opdivId: number) => {
      const od = opdivLabelMap[opdivId]
      return od ? `${od.code} - ${od.name}` : `OpDiv #${opdivId}`
    },
    [opdivLabelMap]
  )

  // Options = assignable + currently-granted, so a chip for a grant to a
  // non-assignable OpDiv still resolves against the options (no MUI "value not
  // in options" warning, no blank chip). filterOptions below narrows the
  // DROPDOWN back to the assignable set so those grants are not re-selectable.
  const sortedOptionIds = React.useMemo(() => {
    const ids = new Set<number>(assignableIds)
    for (const id of localOpDivs) ids.add(id)
    return Array.from(ids).sort((a, b) =>
      optionLabel(a).localeCompare(optionLabel(b))
    )
  }, [assignableIds, localOpDivs, optionLabel])

  const baseFilter = React.useMemo(() => createFilterOptions<number>(), [])

  const handleError = React.useCallback((error: unknown) => {
    if (isAuthHandled(error)) return
    const parsed = parseApiError(error)
    notify(parsed.message, 'error')
  }, [])

  React.useEffect(() => {
    if (open && userid) {
      let cancelled = false
      setLoading(true)
      setFetchFailed(false)
      setLocalOpDivs([])
      fetchUserOpDivs(String(userid))
        .then((grants) => {
          if (!cancelled) setLocalOpDivs(grants)
        })
        .catch((error) => {
          if (!cancelled) {
            handleError(error)
            setFetchFailed(true)
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    } else {
      setFetchFailed(false)
      setLoading(false)
      setLocalOpDivs([])
    }
  }, [open, userid, handleError])

  const handleSave = () => {
    setSaving(true)
    // Scoped caller (OPDIV_ADMIN): drop grants outside the assignable set so the
    // batch request never includes out-of-scope IDs the target holds from
    // another admin - the backend rejects any desired set containing an ID the
    // caller doesn't hold. Unscoped caller (OWNER/HHS_ADMIN): send every grant
    // as-is, since omitting the target's non-assignable grants would revoke
    // them.
    const idsToSave = enforceCallerScope
      ? localOpDivs.filter((id) => assignableIds.has(id))
      : localOpDivs
    setUserOpDivs(String(userid), idsToSave)
      .then(() => {
        notify('Saved', 'success')
        onChanged?.(String(userid))
        handleClose()
      })
      .catch((error) => handleError(error))
      .finally(() => setSaving(false))
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      aria-label={`Assign OpDivs for ${userName}`}
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
          disabled={loading || fetchFailed}
          disableClearable
          getOptionLabel={optionLabel}
          // Keep the dropdown scoped to the assignable set even though options
          // also carries current non-assignable grants (for chip resolution).
          filterOptions={(options, params) =>
            baseFilter(options, params).filter((o) => assignableIds.has(o))
          }
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option}>
              <Checkbox style={{ marginRight: 8 }} checked={selected} />
              {optionLabel(option)}
            </li>
          )}
          value={localOpDivs}
          onChange={(_event, newValue) => setLocalOpDivs(newValue)}
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
        <CmsButton onClick={handleClose} variation="ghost">
          Cancel
        </CmsButton>
        <CmsButton
          onClick={handleSave}
          disabled={saving || loading || fetchFailed}
        >
          Save
        </CmsButton>
      </DialogActions>
    </Dialog>
  )
}
