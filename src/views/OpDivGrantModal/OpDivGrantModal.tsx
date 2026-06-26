import React from 'react'
import { Box, Button, Checkbox, Typography } from '@mui/material'
import Modal from '@/components/ds/Modal'
import { GridRowId } from '@mui/x-data-grid'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { CodeBadge } from '@/components/ds/StatusChip'
import { fetchUserOpDivs, grantOpDiv, revokeOpDiv } from '@/utils/userOpdivs'
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
   * Fired after a confirmed grant or revoke so the caller can refresh the
   * user's row (grants + derived identity_provider) against post-mutation
   * server state.
   */
  onChanged?: (userid: string) => void
}

type View = 'selected' | 'all'

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
 * the mockup (frame 17) in the shared Modal shell, replacing the legacy
 * SideDrawer + Autocomplete. Behavior is unchanged: checking a row grants
 * immediately, unchecking opens a confirm dialog before the revoke, and
 * the footer Done button just closes - nothing is queued.
 */
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
  const [view, setView] = React.useState<View>('all')

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

  const visibleOpDivs = React.useMemo(
    () =>
      view === 'selected'
        ? sortedOptionIds.filter((id) => assignedOpDivs.includes(id))
        : sortedOptionIds,
    [view, sortedOptionIds, assignedOpDivs]
  )

  // Reset to the All view whenever the modal opens so a previous Selected
  // view from a different user doesn't carry over.
  React.useEffect(() => {
    if (open) setView('all')
  }, [open])

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

  const handleToggle = (opdivId: number, checked: boolean) => {
    if (checked) {
      grantOpDiv(String(userid), opdivId)
        .then(() => {
          setAssignedOpDivs((prev) =>
            prev.includes(opdivId) ? prev : [...prev, opdivId]
          )
          notify('Saved - granted OpDiv', 'success')
          onChanged?.(String(userid))
        })
        .catch((error) => handleError(error))
    } else {
      setPendingRevoke({ opdivId })
    }
  }

  // Fall back to a stable placeholder when an assigned OpDiv is not present
  // in the option set (e.g. an OPDIV_ADMIN viewing a target who has grants
  // for OpDivs outside the actor's own scope, or a recently-deactivated
  // OpDiv).
  const optionLabel = (opdivId: number) => {
    const od = opdivMap[opdivId]
    return od ? `${od.code} - ${od.name}` : `OpDiv #${opdivId}`
  }

  const selectedCount = assignedOpDivs.length
  const totalCount = sortedOptionIds.length

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Assign OpDivs"
        eyebrow={userName || undefined}
        size="sm"
        footer={
          <Button
            variant="contained"
            color="primary"
            onClick={handleClose}
            sx={{ borderRadius: `${radius.button}px` }}
          >
            Done
          </Button>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
            OpDiv Admins manage users and systems within their assigned OpDivs.
          </Typography>

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
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {visibleOpDivs.length === 0 ? (
              <Typography
                sx={{
                  fontSize: 13,
                  color: colors.neutral500,
                  textAlign: 'center',
                  py: 3,
                }}
              >
                {view === 'selected'
                  ? 'No OpDivs assigned yet.'
                  : 'No OpDivs available.'}
              </Typography>
            ) : (
              visibleOpDivs.map((opdivId) => {
                const od = opdivMap[opdivId]
                const isAssigned = assignedOpDivs.includes(opdivId)
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
