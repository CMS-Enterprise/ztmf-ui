import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import { FismaSystemType, DelegateRow, DelegateCandidate } from '@/types'
import {
  fetchSystemDelegates,
  searchDelegateCandidates,
  addSystemDelegate,
  removeSystemDelegate,
  renewSystemDelegate,
} from '@/utils/delegates'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { getTodayISO, addMonthsISO } from '@/utils/decommission'

// Same shape UserTable validates against; the backend is the authority, this
// only catches obvious typos before the round-trip.
const EMAIL_RE = /^[a-zA-Z0-9._:$!%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/

const ADMIN_REQUIRED_MSG =
  'That email belongs to an existing account that must be handled by an administrator. Ask an admin to add this user.'
const CAPABILITY_OFF_MSG =
  'System Delegate self-service is not enabled for this OpDiv.'

// A picked YYYY-MM-DD expires at the end of that day (UTC), so the delegate
// keeps access through the date shown.
function dateToExpiryISO(date: string): string {
  return new Date(`${date}T23:59:59.000Z`).toISOString()
}

// A delegate within this many days of expiry is flagged "Expiring soon" so a
// manager can renew before access lapses.
const EXPIRING_SOON_DAYS = 30

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (isNaN(ms)) return null
  return Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24))
}

// At-a-glance roster status. Delegates always carry an expiry, so the null
// case (a non-expiring account) simply reads as Active.
function delegateStatus(iso: string | null): {
  label: string
  color: 'success' | 'warning' | 'error'
} {
  const days = daysUntil(iso)
  if (days === null) return { label: 'Active', color: 'success' }
  if (days < 0) return { label: 'Expired', color: 'error' }
  if (days <= EXPIRING_SOON_DAYS)
    return { label: 'Expiring soon', color: 'warning' }
  return { label: 'Active', color: 'success' }
}

function formatExpiry(iso: string | null): string {
  if (!iso) return 'No expiration'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

interface Props {
  system: FismaSystemType
  /**
   * Whether the current user may add/invite/remove/renew delegates. ISSO and
   * admins qualify; ISSM (and other assigned viewers) see the roster read-only.
   * The backend re-checks on every write.
   */
  canManage: boolean
}

/**
 * Delegates section for the FISMA system detail page. Lists the system's
 * current delegates with their expiration, and - for a manager - lets an
 * ISSO attach an existing eligible delegate, invite a new person, renew an
 * expiration, or remove a delegate. All scope is the one system in `system`;
 * the backend enforces assignment and OpDiv rules.
 */
export default function SystemDelegatesSection({ system, canManage }: Props) {
  const systemId = system.fismasystemid

  const [delegates, setDelegates] = useState<DelegateRow[]>([])
  const [loading, setLoading] = useState(true)

  // Attach-existing picker.
  const [candidates, setCandidates] = useState<DelegateCandidate[]>([])
  const [candidateInput, setCandidateInput] = useState('')
  const [attaching, setAttaching] = useState(false)

  // Invite-new dialog.
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteExpiry, setInviteExpiry] = useState(addMonthsISO(3))
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})
  const [inviteGuard, setInviteGuard] = useState('')
  const [inviting, setInviting] = useState(false)

  // Inline guard for administrator-required / capability-off on the ATTACH
  // path (card-level). The invite path shows its own guard inside the dialog.
  const [guardMessage, setGuardMessage] = useState('')

  const [pendingRemove, setPendingRemove] = useState<DelegateRow | null>(null)

  const [renewTarget, setRenewTarget] = useState<DelegateRow | null>(null)
  const [renewDate, setRenewDate] = useState('')
  const [renewError, setRenewError] = useState('')

  const loadRoster = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const rows = await fetchSystemDelegates(systemId, signal)
        if (signal?.aborted) return
        setDelegates(rows)
      } catch (error) {
        if (signal?.aborted || isAuthHandled(error)) return
        notify(parseApiError(error).message, 'error')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [systemId]
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    loadRoster(controller.signal)
    return () => controller.abort()
  }, [loadRoster])

  // Debounced candidate search; only managers see the picker.
  useEffect(() => {
    if (!canManage) return
    const controller = new AbortController()
    const t = setTimeout(() => {
      searchDelegateCandidates(systemId, candidateInput, controller.signal)
        .then((rows) => {
          if (!controller.signal.aborted) setCandidates(rows)
        })
        .catch(() => {
          // Non-fatal: an empty option list just means nothing to attach.
        })
    }, 250)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [systemId, candidateInput, canManage])

  // Classify an add failure so the caller can place it: administrator-required
  // and capability-off become an inline guard string; a 400 field map is
  // returned for the invite form; anything else is toasted here. Returns null
  // when there is nothing to render inline (auth-handled, or already toasted).
  const classifyAddError = (
    error: unknown
  ): { guard?: string; fieldErrors?: Record<string, string> } | null => {
    if (isAuthHandled(error)) return null
    const parsed = parseApiError(error)
    if (parsed.code === 'DELEGATE_REQUIRES_ADMIN')
      return { guard: ADMIN_REQUIRED_MSG }
    if (parsed.status === 403) return { guard: CAPABILITY_OFF_MSG }
    if (parsed.fieldErrors) return { fieldErrors: parsed.fieldErrors }
    notify(parsed.message, 'error')
    return null
  }

  const handleAttach = async (candidate: DelegateCandidate) => {
    setGuardMessage('')
    setAttaching(true)
    try {
      await addSystemDelegate(systemId, { email: candidate.email })
      await loadRoster()
      setCandidateInput('')
      notify('Saved - delegate added', 'success', { autoHideDuration: 1500 })
    } catch (error) {
      const c = classifyAddError(error)
      if (c?.guard) setGuardMessage(c.guard)
    } finally {
      setAttaching(false)
    }
  }

  const validateInvite = (): boolean => {
    const errors: Record<string, string> = {}
    if (!inviteName.trim()) errors.fullname = 'Name is required'
    if (!EMAIL_RE.test(inviteEmail.trim()))
      errors.email = 'A valid email is required'
    if (!inviteExpiry) errors.access_expires_at = 'Expiration is required'
    else if (inviteExpiry < getTodayISO())
      errors.access_expires_at = 'Expiration cannot be in the past'
    setInviteErrors(errors)
    return Object.keys(errors).length === 0
  }

  const openInvite = () => {
    setGuardMessage('')
    setInviteName('')
    setInviteEmail('')
    setInviteExpiry(addMonthsISO(3))
    setInviteErrors({})
    setInviteGuard('')
    setInviteOpen(true)
  }

  const handleInvite = async () => {
    setInviteGuard('')
    if (!validateInvite()) return
    setInviting(true)
    try {
      await addSystemDelegate(systemId, {
        email: inviteEmail.trim(),
        fullname: inviteName.trim(),
        access_expires_at: dateToExpiryISO(inviteExpiry),
      })
      await loadRoster()
      setInviteOpen(false)
      notify('Saved - delegate invited', 'success', { autoHideDuration: 1500 })
    } catch (error) {
      const c = classifyAddError(error)
      if (c?.guard) setInviteGuard(c.guard)
      if (c?.fieldErrors) setInviteErrors(c.fieldErrors)
    } finally {
      setInviting(false)
    }
  }

  const handleConfirmRemove = async (confirm: boolean) => {
    const target = pendingRemove
    setPendingRemove(null)
    if (!confirm || !target) return
    try {
      await removeSystemDelegate(systemId, target.userid)
      await loadRoster()
      notify('Saved - delegate removed', 'success', { autoHideDuration: 1500 })
    } catch (error) {
      if (isAuthHandled(error)) return
      notify(parseApiError(error).message, 'error', { autoHideDuration: 1500 })
    }
  }

  const openRenew = (row: DelegateRow) => {
    setRenewTarget(row)
    setRenewDate(addMonthsISO(3))
    setRenewError('')
  }

  const handleRenew = async () => {
    if (!renewTarget) return
    if (!renewDate || renewDate < getTodayISO()) {
      setRenewError('Expiration cannot be in the past')
      return
    }
    try {
      await renewSystemDelegate(
        systemId,
        renewTarget.userid,
        dateToExpiryISO(renewDate)
      )
      setRenewTarget(null)
      await loadRoster()
      notify('Saved - expiration updated', 'success', {
        autoHideDuration: 1500,
      })
    } catch (error) {
      if (isAuthHandled(error)) return
      notify(parseApiError(error).message, 'error', { autoHideDuration: 1500 })
    }
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Delegates"
        titleTypographyProps={{ variant: 'h6' }}
        subheader="Contractor and support-staff access to this system's data-call answers"
        sx={{ pb: 0 }}
      />
      <CardContent>
        {guardMessage && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            onClose={() => setGuardMessage('')}
          >
            {guardMessage}
          </Alert>
        )}

        {canManage && (
          <Box sx={{ mb: 3, maxWidth: 640 }}>
            <Autocomplete
              options={candidates}
              value={null}
              blurOnSelect
              clearOnBlur
              disabled={attaching}
              filterOptions={(x) => x}
              getOptionLabel={(o) => `${o.fullname} (${o.email})`}
              isOptionEqualToValue={(a, b) => a.userid === b.userid}
              inputValue={candidateInput}
              onInputChange={(_e, v) => setCandidateInput(v)}
              onChange={(_e, value) => {
                if (value) handleAttach(value)
              }}
              noOptionsText="No eligible delegates"
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Attach an existing delegate"
                  placeholder="Search by name or email"
                  variant="standard"
                  InputLabelProps={{ sx: { marginTop: 0 } }}
                />
              )}
            />

            <Button size="small" sx={{ mt: 1.5 }} onClick={openInvite}>
              + Invite new delegate
            </Button>

            <Divider sx={{ mt: 3 }} />
          </Box>
        )}

        {loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading delegates...
          </Typography>
        ) : delegates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No delegates on this system.
          </Typography>
        ) : (
          <List disablePadding>
            {delegates.map((d) => {
              const status = delegateStatus(d.access_expires_at)
              return (
                <ListItem
                  key={d.userid}
                  divider
                  secondaryAction={
                    canManage ? (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Renew expiration">
                          <IconButton
                            edge="end"
                            aria-label={`Renew ${d.fullname}`}
                            onClick={() => openRenew(d)}
                          >
                            <EventRepeatIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove delegate">
                          <IconButton
                            edge="end"
                            aria-label={`Remove ${d.fullname}`}
                            onClick={() => setPendingRemove(d)}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : undefined
                  }
                >
                  <ListItemText
                    primary={
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <span>{d.fullname}</span>
                        <Chip
                          label={status.label}
                          color={status.color}
                          size="small"
                          variant={
                            status.color === 'success' ? 'outlined' : 'filled'
                          }
                        />
                      </Box>
                    }
                    secondary={`${d.email} - Expires ${formatExpiry(
                      d.access_expires_at
                    )}`}
                  />
                </ListItem>
              )
            })}
          </List>
        )}
      </CardContent>

      <ConfirmDialog
        title="Confirm Remove Delegate"
        confirmationText={
          pendingRemove
            ? `Remove ${pendingRemove.fullname} (${pendingRemove.email}) as a delegate on this system? Their access to other systems is unaffected.`
            : ''
        }
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        confirmClick={handleConfirmRemove}
        confirmLabel="Remove"
      />

      <Dialog
        open={renewTarget !== null}
        onClose={() => setRenewTarget(null)}
        maxWidth="xs"
        fullWidth
        aria-label="Renew delegate expiration"
      >
        <DialogTitle>Renew Delegate Expiration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {renewTarget
              ? `Set a new expiration for ${renewTarget.fullname}. Expiration is per-user, so this applies to every system they are a delegate on.`
              : ''}
          </Typography>
          <TextField
            label="Access expires"
            type="date"
            variant="standard"
            fullWidth
            value={renewDate}
            onChange={(e) => setRenewDate(e.target.value)}
            error={!!renewError}
            helperText={renewError}
            InputLabelProps={{ shrink: true, sx: { marginTop: 0 } }}
          />
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={() => setRenewTarget(null)}>Cancel</CmsButton>
          <CmsButton onClick={handleRenew}>Save</CmsButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        maxWidth="xs"
        fullWidth
        aria-label="Invite new delegate"
      >
        <DialogTitle>Invite New Delegate</DialogTitle>
        <DialogContent>
          {inviteGuard && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {inviteGuard}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              variant="standard"
              required
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              error={!!inviteErrors.fullname}
              helperText={inviteErrors.fullname}
              InputLabelProps={{ sx: { marginTop: 0 } }}
            />
            <TextField
              label="Email"
              variant="standard"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              error={!!inviteErrors.email}
              helperText={inviteErrors.email}
              InputLabelProps={{ sx: { marginTop: 0 } }}
            />
            <TextField
              label="Access expires"
              type="date"
              variant="standard"
              required
              value={inviteExpiry}
              onChange={(e) => setInviteExpiry(e.target.value)}
              error={!!inviteErrors.access_expires_at}
              helperText={
                inviteErrors.access_expires_at ??
                'Defaults to three months from today'
              }
              InputLabelProps={{ shrink: true, sx: { marginTop: 0 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={() => setInviteOpen(false)} disabled={inviting}>
            Cancel
          </CmsButton>
          <CmsButton onClick={handleInvite} disabled={inviting}>
            {inviting ? 'Inviting...' : 'Invite'}
          </CmsButton>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
