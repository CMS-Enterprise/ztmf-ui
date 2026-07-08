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
   * Assignable OpDivs, already scoped by the caller (children only, active,
   * and - for an OPDIV_ADMIN actor - limited to their own OpDivs). The modal
   * does not re-scope; it renders exactly what it is given.
   */
  opdivOptions: OpDiv[]
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
  opdivOptions,
  onChanged,
}: Props) {
  const [localOpDivs, setLocalOpDivs] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [fetchFailed, setFetchFailed] = React.useState(false)
  const [view, setView] = React.useState<View>('all')
  const [search, setSearch] = React.useState<string>('')

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

  const visibleOpDivs = React.useMemo(() => {
    const scoped =
      view === 'selected'
        ? sortedOptionIds.filter((id) => localOpDivs.includes(id))
        : sortedOptionIds
    const needle = search.trim().toLowerCase()
    if (!needle) return scoped
    return scoped.filter((id) => {
      const od = opdivMap[id]
      if (!od) return false
      return (
        od.code.toLowerCase().includes(needle) ||
        od.name.toLowerCase().includes(needle)
      )
    })
  }, [view, sortedOptionIds, localOpDivs, opdivMap, search])

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
    // An OPDIV_ADMIN's scope is already encoded in sortedOptionIds (only
    // their own OpDivs appear as options). Filter localOpDivs to that set so
    // the batch request never includes out-of-scope IDs the target user
    // holds from another admin - the backend scope gate rejects any desired
    // set that contains an ID the caller doesn't hold, even if they didn't
    // add it.
    const scopedIds = localOpDivs.filter((id) => sortedOptionIds.includes(id))
    try {
      await setUserOpDivs(String(userid), scopedIds)
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
            disabled={saving || controlsDisabled}
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
              const od = opdivMap[opdivId]
              const isAssigned = localOpDivs.includes(opdivId)
              return (
                <Box
                  key={opdivId}
                  component="label"
                  htmlFor={`assign-opdiv-${opdivId}`}
                  sx={rowSx}
                >
                  <Checkbox
                    id={`assign-opdiv-${opdivId}`}
                    checked={isAssigned}
                    disabled={controlsDisabled}
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
