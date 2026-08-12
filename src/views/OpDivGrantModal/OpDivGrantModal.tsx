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
import SearchIcon from '@mui/icons-material/Search'
import { CodeBadge } from '@/components/ui/StatusChip'
import { fetchUserOpDivs, setUserOpDivs } from '@/utils/userOpdivs'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { colors, radius } from '@/theme/tokens'
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

type View = 'selected' | 'all'

const searchInputSx = {
  height: 36,
  fontSize: 13,
  '& .MuiOutlinedInput-input': { padding: '0 0' },
  '& fieldset': { borderColor: colors.border },
}

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  px: 1.75,
  py: 1.25,
  borderBottom: `1px solid ${colors.neutral100}`,
  cursor: 'pointer',
  '&:last-of-type': { borderBottom: 'none' },
  '&:hover': { backgroundColor: colors.neutral50 },
}

/** Pill-style toggle for the Selected/All view switcher. */
function PillTab({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      sx={{
        font: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        border: active ? 'none' : `1px solid ${colors.neutral200}`,
        backgroundColor: active ? colors.primary50 : colors.white,
        color: active ? colors.primary : colors.ink,
        cursor: 'pointer',
      }}
    >
      {children}
    </Box>
  )
}

/**
 * Assign OpDivs modal. Renders the pill-tab + checkbox list described by
 * the mockup (frame 17) in the shared Modal shell.
 *
 * Grants are batched: checking and unchecking rows only mutates local
 * state, and one PUT /users/{id}/opdivs commits the full desired set when
 * the user clicks Save. Cancel discards everything - so unchecking needs
 * no confirm dialog; nothing is destructive until Save.
 */
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
  const [view, setView] = React.useState<View>('all')
  const [search, setSearch] = React.useState<string>('')

  // The caller's raw backend scope (IsAssignedOpDiv). Superset of assignableIds
  // - it also covers grants to OpDivs since re-parented/deactivated. Gates the
  // scoped save and the row lock, so both agree with what the backend acts on.
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
  // so a grant to an OpDiv missing from the map never renders blank.
  const optionLabel = React.useCallback(
    (opdivId: number) => {
      const od = opdivLabelMap[opdivId]
      return od ? `${od.code} - ${od.name}` : `OpDiv #${opdivId}`
    },
    [opdivLabelMap]
  )

  // Rows = assignable + currently-granted, so a grant to a non-assignable
  // OpDiv still renders (labeled) instead of disappearing; the row lock below
  // keeps those from being re-toggled out of scope.
  const sortedOptionIds = React.useMemo(() => {
    const ids = new Set<number>(assignableIds)
    for (const id of localOpDivs) ids.add(id)
    return Array.from(ids).sort((a, b) =>
      optionLabel(a).localeCompare(optionLabel(b))
    )
  }, [assignableIds, localOpDivs, optionLabel])

  const visibleOpDivs = React.useMemo(() => {
    const scoped =
      view === 'selected'
        ? sortedOptionIds.filter((id) => localOpDivs.includes(id))
        : sortedOptionIds
    const needle = search.trim().toLowerCase()
    if (!needle) return scoped
    return scoped.filter((id) => {
      const od = opdivLabelMap[id]
      if (!od) return false
      return (
        od.code.toLowerCase().includes(needle) ||
        od.name.toLowerCase().includes(needle)
      )
    })
  }, [view, sortedOptionIds, localOpDivs, opdivLabelMap, search])

  // Reset transient view state whenever the modal opens/closes so a
  // previous user's filter doesn't carry over and per the project rule
  // that closed modals must not retain validation/UI state.
  React.useEffect(() => {
    if (open) setView('all')
    if (!open) setSearch('')
  }, [open])

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

  const handleToggle = (opdivId: number, checked: boolean) => {
    setLocalOpDivs((prev) =>
      checked
        ? prev.includes(opdivId)
          ? prev
          : [...prev, opdivId]
        : prev.filter((id) => id !== opdivId)
    )
  }

  const handleSave = async () => {
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
    try {
      await setUserOpDivs(String(userid), idsToSave)
      notify('Saved', 'success')
      onChanged?.(String(userid))
      handleClose()
    } catch (error) {
      handleError(error)
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = localOpDivs.length
  const totalCount = sortedOptionIds.length
  const controlsDisabled = loading || fetchFailed

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Assign OpDivs"
      eyebrow={userName || undefined}
      size="md"
      dense
      footer={
        <>
          <Button variant="text" color="inherit" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving || controlsDisabled || callerHasNoScope}
            sx={{ borderRadius: `${radius.button}px` }}
          >
            Save
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          OpDiv Admins manage users and systems within their assigned OpDivs.
        </Typography>

        <OutlinedInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code or name"
          fullWidth
          disabled={controlsDisabled}
          sx={searchInputSx}
          startAdornment={
            <InputAdornment position="start" sx={{ ml: 1.25, mr: 1 }}>
              <SearchIcon sx={{ fontSize: 16, color: colors.neutral500 }} />
            </InputAdornment>
          }
          inputProps={{ 'aria-label': 'Search OpDivs' }}
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <PillTab
            active={view === 'selected'}
            onClick={() => setView('selected')}
          >
            Selected ({selectedCount})
          </PillTab>
          <PillTab active={view === 'all'} onClick={() => setView('all')}>
            All OpDivs ({totalCount})
          </PillTab>
        </Box>

        <Box
          sx={{
            border: `1px solid ${colors.neutral200}`,
            borderRadius: 1,
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {fetchFailed ? (
            <Typography
              sx={{
                fontSize: 13,
                color: colors.danger,
                textAlign: 'center',
                py: 3,
              }}
            >
              Could not load this user&apos;s OpDivs. Close and try again.
            </Typography>
          ) : loading ? (
            <Typography
              sx={{
                fontSize: 13,
                color: colors.neutral500,
                textAlign: 'center',
                py: 3,
              }}
            >
              Loading OpDivs...
            </Typography>
          ) : visibleOpDivs.length === 0 ? (
            <Typography
              sx={{
                fontSize: 13,
                color: colors.neutral500,
                textAlign: 'center',
                py: 3,
              }}
            >
              {search.trim()
                ? 'No OpDivs match your search.'
                : view === 'selected'
                  ? 'No OpDivs selected yet.'
                  : 'No OpDivs available.'}
            </Typography>
          ) : (
            visibleOpDivs.map((opdivId) => {
              const od = opdivLabelMap[opdivId]
              const isAssigned = localOpDivs.includes(opdivId)
              // Lock rows for grants outside a scoped caller's backend
              // scope: those come from another admin, the save strips them
              // from the PUT regardless, so a toggle would be a silent
              // no-op. Unscoped callers keep every row toggleable.
              const locked =
                enforceCallerScope && isAssigned && !callerScope.has(opdivId)
              return (
                <Box
                  key={opdivId}
                  component="label"
                  htmlFor={`assign-opdiv-${opdivId}`}
                  sx={{ ...rowSx, ...(locked && { opacity: 0.65 }) }}
                >
                  <Checkbox
                    id={`assign-opdiv-${opdivId}`}
                    checked={isAssigned}
                    disabled={controlsDisabled || locked}
                    onChange={(e) => handleToggle(opdivId, e.target.checked)}
                    sx={{ p: 0.5 }}
                  />
                  {od ? (
                    <>
                      <CodeBadge code={od.code} />
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.ink,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {od.name}
                      </Typography>
                    </>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.ink,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      OpDiv #{opdivId}
                    </Typography>
                  )}
                </Box>
              )
            })
          )}
        </Box>
      </Box>
    </Modal>
  )
}
