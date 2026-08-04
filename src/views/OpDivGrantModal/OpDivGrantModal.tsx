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
   * All assignable OpDivs (active, non-parent) - the full universe BEFORE any
   * caller-scope narrowing. For a scoped caller the modal narrows this to the
   * caller's own current grants itself, fetched fresh on open, so the dropdown
   * reflects a mid-session change to the caller's grants rather than the
   * session-old userInfo. Drives the dropdown.
   */
  assignableOpDivs: OpDiv[]
  /**
   * Full label source (all OpDivs, incl. parent/inactive), keyed by opdiv_id.
   * Separate from assignableOpDivs so a grant to a non-assignable OpDiv still
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
   * The acting admin's own user id. When enforceCallerScope is true the modal
   * fetches this user's CURRENT OpDiv grants on open - the backend's true
   * add/remove scope (IsAssignedOpDiv) - and uses that fresh set as BOTH the
   * dropdown's assignable narrowing and the save-time preserve boundary. Read
   * from a fresh fetch rather than the session userInfo, whose assignedopdivids
   * is loaded once and never refreshed, so a mid-session grant change to the
   * caller can't silently revoke a target's grant on save. Only fetched when
   * enforceCallerScope is true.
   */
  callerUserId: string
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
  assignableOpDivs,
  opdivLabelMap,
  enforceCallerScope,
  callerUserId,
  onChanged,
}: Props) {
  const [localOpDivs, setLocalOpDivs] = React.useState<number[]>([])
  // The caller's own current grants, fetched fresh on open (scoped callers
  // only). The backend's true add/remove scope (IsAssignedOpDiv), used for both
  // the dropdown narrowing and the save-time preserve boundary.
  const [callerGrantIds, setCallerGrantIds] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [fetchFailed, setFetchFailed] = React.useState(false)

  // The caller's raw backend scope (IsAssignedOpDiv). Superset of assignableIds
  // - it also covers grants to OpDivs since re-parented/deactivated. Gates the
  // scoped save and the chip lock, so both agree with what the backend acts on.
  const callerScope = React.useMemo(
    () => new Set(callerGrantIds),
    [callerGrantIds]
  )

  // A scoped caller with no grants of their own has nothing they may grant, and
  // a save would PUT an empty desired set. That is a no-op under the backend's
  // grant-membership toRemove gate (nothing the caller doesn't hold is removed),
  // but block it anyway: it avoids a pointless request and keeps the frontend
  // safe if that gate ever changes. (During loading callerScope is empty too,
  // but Save is already disabled by `loading`, so this only bites post-fetch.)
  const callerHasNoScope = enforceCallerScope && callerScope.size === 0

  // The dropdown's assignable set: all active/non-parent OpDivs, narrowed to the
  // caller's own fresh scope for a scoped caller so it never offers an OpDiv the
  // backend would 403 on. Kept a subset of callerScope, which is what keeps the
  // save from stripping a legitimately-held grant.
  const assignableIds = React.useMemo(() => {
    const full = assignableOpDivs.map((od) => od.opdiv_id)
    if (!enforceCallerScope) return new Set(full)
    return new Set(full.filter((id) => callerScope.has(id)))
  }, [assignableOpDivs, enforceCallerScope, callerScope])

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
      setCallerGrantIds([])
      // Fetch the target's grants and, for a scoped caller, the caller's own
      // current grants. Fetching the caller's scope fresh (rather than reading
      // the session-old userInfo) is what closes the staleness gap: an admin
      // whose own grants changed mid-session gets the current scope on open.
      // A seconds-wide open-to-save TOCTOU remains by design - a concurrent
      // change to the caller's OWN grants during an active edit isn't caught
      // until the next open. That's unclosable client-side (a save-time refetch
      // only narrows it) and the backend's grant-membership gate is the final
      // authority; don't move this to save-time to chase it.
      // When the caller opens the modal on their OWN row the two are the same
      // request, so reuse the one promise instead of an identical second GET.
      const targetPromise = fetchUserOpDivs(String(userid))
      const callerScopePromise = !enforceCallerScope
        ? Promise.resolve<number[]>([])
        : callerUserId === String(userid)
          ? targetPromise
          : fetchUserOpDivs(callerUserId)
      Promise.allSettled([targetPromise, callerScopePromise])
        .then(([targetRes, callerRes]) => {
          if (cancelled) return
          if (targetRes.status === 'fulfilled') setLocalOpDivs(targetRes.value)
          if (callerRes.status === 'fulfilled')
            setCallerGrantIds(callerRes.value)
          // Either fetch failing blocks the save: a missing target list, or
          // (worse) a missing caller scope, could revoke grants - fetchFailed
          // disables the picker and Save so the empty fallback scope is never
          // acted on. Surface a single error; a second identical toast when both
          // fail adds nothing, and any 401 redirect is handled by the axios
          // interceptor regardless of which reason we pass here.
          const failure =
            targetRes.status === 'rejected'
              ? targetRes.reason
              : callerRes.status === 'rejected'
                ? callerRes.reason
                : null
          if (failure) {
            handleError(failure)
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
      setCallerGrantIds([])
    }
  }, [open, userid, callerUserId, enforceCallerScope, handleError])

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
          disabled={saving || loading || fetchFailed || callerHasNoScope}
        >
          Save
        </CmsButton>
      </DialogActions>
    </Dialog>
  )
}
