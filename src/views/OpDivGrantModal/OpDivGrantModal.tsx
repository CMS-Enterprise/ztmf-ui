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
   * grants outside the caller's own scope, since the backend rejects a desired
   * set containing an ID the caller doesn't hold. False for unscoped admins
   * (OWNER/HHS_ADMIN), whose save must PRESERVE the target's out-of-scope
   * grants - omitting them reads as a revocation.
   */
  enforceCallerScope: boolean
  /**
   * The caller's RAW own-grant ids - the backend's true add/remove scope
   * (IsAssignedOpDiv), unfiltered by parent/active. This is the save-time
   * preserve boundary and MUST be a superset of the dropdown's assignable set:
   * opdivOptions is additionally narrowed to !is_parent && active, so a grant
   * the caller holds to an OpDiv that was later re-parented or deactivated is
   * absent from opdivOptions but still in the caller's backend scope. Filtering
   * the save on the narrower opdivOptions would strip such a grant from the PUT
   * and the backend would then revoke it (its toRemove gate is pure grant
   * membership) - the same silent-revocation this modal exists to prevent.
   * Only consulted when enforceCallerScope is true.
   */
  callerGrantIds: number[]
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
  callerGrantIds,
  onChanged,
}: Props) {
  const [localOpDivs, setLocalOpDivs] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [fetchFailed, setFetchFailed] = React.useState(false)

  // The assignable set drives the dropdown (what may be newly selected).
  const assignableIds = React.useMemo(
    () => new Set(opdivOptions.map((od) => od.opdiv_id)),
    [opdivOptions]
  )

  // The caller's raw backend scope (IsAssignedOpDiv). Superset of assignableIds
  // - it also covers grants to OpDivs since re-parented/deactivated. Gates the
  // scoped save and the chip lock, so both agree with what the backend will act
  // on (see the callerGrantIds prop docs).
  const callerScope = React.useMemo(
    () => new Set(callerGrantIds),
    [callerGrantIds]
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
    // Scoped caller (OPDIV_ADMIN): keep only grants within the caller's own
    // backend scope (callerScope), so the batch request never includes ids the
    // target holds from another admin - the backend rejects a desired set
    // containing an id the caller doesn't hold. callerScope (not assignableIds)
    // is used deliberately: a caller-held grant to a now parent/inactive OpDiv
    // is absent from assignableIds but still in the caller's backend scope, so
    // filtering on assignableIds would drop it from the PUT and the backend
    // would revoke it. Unscoped caller (OWNER/HHS_ADMIN): send every grant
    // as-is, since omitting the target's non-assignable grants would revoke
    // them.
    const idsToSave = enforceCallerScope
      ? localOpDivs.filter((id) => callerScope.has(id))
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
          options={sortedOptionIds}
          disabled={loading || fetchFailed}
          disableClearable
          getOptionLabel={optionLabel}
          // Keep the dropdown scoped to the assignable set even though options
          // also carries current non-assignable grants (for chip resolution).
          filterOptions={(options, params) =>
            baseFilter(options, params).filter((o) => assignableIds.has(o))
          }
          // Lock (drop the delete button on) only chips outside the caller's
          // backend scope for a scoped caller: those are grants from another
          // admin that the save strips regardless, so a delete would be a
          // silent no-op. A caller-held grant (incl. one to a now
          // parent/inactive OpDiv) stays deletable - removing it is a real,
          // permitted revocation. Unscoped callers keep delete on everything.
          // No limitTags collapse - surfacing every grant, including the
          // non-assignable ones, is the point of this fix.
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, onDelete, ...tagProps } = getTagProps({ index })
              const locked = enforceCallerScope && !callerScope.has(option)
              return (
                <Chip
                  {...tagProps}
                  key={key}
                  label={optionLabel(option)}
                  onDelete={locked ? undefined : onDelete}
                />
              )
            })
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
