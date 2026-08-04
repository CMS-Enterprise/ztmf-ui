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
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import AddIcon from '@mui/icons-material/Add'
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

function candidateLabel(o: DelegateCandidate): string {
  return `${o.fullname} (${o.email})`
}

interface Props {
  system: FismaSystemType
  /**
   * Whether the current user may attach/provision/remove/renew delegates.
   * ISSO and admins qualify; ISSM (and other assigned viewers) see the roster
   * read-only. The backend re-checks on every write.
   */
  canManage: boolean
}

/**
 * Delegates section for the FISMA system detail page. Lists the system's
 * current delegates with their expiration, and - for a manager - lets an
 * ISSO attach an existing eligible delegate, provision a new one, renew an
 * expiration, or remove a delegate. All scope is the one system in `system`;
 * the backend enforces assignment and OpDiv rules.
 *
 * "Provision" (not "invite") is deliberate: the backend creates the account
 * directly; no email is sent, and the person signs in through SSO afterward.
 */
export default function SystemDelegatesSection({ system, canManage }: Props) {
  const systemId = system.fismasystemid

  const [delegates, setDelegates] = useState<DelegateRow[]>([])
  const [loading, setLoading] = useState(true)
  // Bumped on every successful roster load. The candidate search keys off
  // this rather than the `delegates` array so the refresh does not depend on
  // the array's referential identity changing.
  const [rosterVersion, setRosterVersion] = useState(0)

  // Attach-existing picker.
  const [candidates, setCandidates] = useState<DelegateCandidate[]>([])
  const [candidateInput, setCandidateInput] = useState('')
  const [attaching, setAttaching] = useState(false)

  // Provision-new dialog.
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisionName, setProvisionName] = useState('')
  const [provisionEmail, setProvisionEmail] = useState('')
  const [provisionExpiry, setProvisionExpiry] = useState(addMonthsISO(3))
  const [provisionErrors, setProvisionErrors] = useState<
    Record<string, string>
  >({})
  const [provisionGuard, setProvisionGuard] = useState('')
  const [provisioning, setProvisioning] = useState(false)

  // Inline guard for administrator-required / capability-off on the ATTACH
  // path (card-level). The provision path shows its own guard in the dialog.
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
        setRosterVersion((v) => v + 1)
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

  // Debounced candidate search; only managers see the picker. Re-runs on
  // rosterVersion because the eligible set excludes anyone already on the
  // system: removing a delegate makes them a candidate again, and attaching
  // one drops them from the list, so the picker has to refresh whenever the
  // roster does rather than going stale until a page reload.
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
  }, [systemId, candidateInput, canManage, rosterVersion])

  // Classify an add failure so the caller can place it: administrator-required
  // and capability-off become an inline guard string; a 400 field map is
  // returned for the provision form; anything else is toasted here. Returns
  // null when there is nothing to render inline (auth-handled, or toasted).
  const classifyAddError = (
    error: unknown
  ): { guard?: string; fieldErrors?: Record<string, string> } | null => {
    if (isAuthHandled(error)) return null
    const parsed = parseApiError(error)
    if (parsed.code === 'DELEGATE_REQUIRES_ADMIN')
      return { guard: ADMIN_REQUIRED_MSG }
    if (parsed.code === 'DELEGATE_NOT_ENABLED')
      return { guard: CAPABILITY_OFF_MSG }
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
      // The attach call sends only a validated email, so a 400 field map is
      // not expected here - but surface it rather than swallowing it if the
      // backend ever returns one (no provision form to route it into).
      else if (c?.fieldErrors)
        setGuardMessage(Object.values(c.fieldErrors).join(' '))
    } finally {
      setAttaching(false)
    }
  }

  const validateProvision = (): boolean => {
    const errors: Record<string, string> = {}
    if (!provisionName.trim()) errors.fullname = 'Name is required'
    if (!EMAIL_RE.test(provisionEmail.trim()))
      errors.email = 'A valid email is required'
    if (!provisionExpiry) errors.access_expires_at = 'Expiration is required'
    else if (provisionExpiry < getTodayISO())
      errors.access_expires_at = 'Expiration cannot be in the past'
    setProvisionErrors(errors)
    return Object.keys(errors).length === 0
  }

  const openProvision = () => {
    setGuardMessage('')
    setProvisionName('')
    setProvisionEmail('')
    setProvisionExpiry(addMonthsISO(3))
    setProvisionErrors({})
    setProvisionGuard('')
    setProvisionOpen(true)
  }

  const handleProvision = async () => {
    setProvisionGuard('')
    if (!validateProvision()) return
    setProvisioning(true)
    try {
      await addSystemDelegate(systemId, {
        email: provisionEmail.trim(),
        fullname: provisionName.trim(),
        access_expires_at: dateToExpiryISO(provisionExpiry),
      })
      await loadRoster()
      setProvisionOpen(false)
      notify('Saved - delegate provisioned', 'success', {
        autoHideDuration: 1500,
      })
    } catch (error) {
      const c = classifyAddError(error)
      if (c?.guard) setProvisionGuard(c.guard)
      if (c?.fieldErrors) setProvisionErrors(c.fieldErrors)
    } finally {
      setProvisioning(false)
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

  const count = !loading && delegates.length > 0 ? ` (${delegates.length})` : ''

  return (
    <Card variant="outlined">
      <CardHeader
        title={`Delegates${count}`}
        titleTypographyProps={{ variant: 'h6' }}
        subheader="Contractor and support-staff access to this system's data-call answers"
        action={
          canManage ? (
            <Button startIcon={<AddIcon />} onClick={openProvision}>
              Provision new delegate
            </Button>
          ) : undefined
        }
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
              getOptionLabel={(o) => candidateLabel(o)}
              isOptionEqualToValue={(a, b) => a.userid === b.userid}
              // Same status chip the roster uses, so an expiring or expired
              // candidate reads the same way in both places. Attaching an
              // expired one is allowed but still needs a renew to grant access.
              renderOption={(props, option) => {
                const status = delegateStatus(option.access_expires_at ?? null)
                return (
                  <li {...props} key={option.userid}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{candidateLabel(option)}</span>
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                        variant={
                          status.color === 'success' ? 'outlined' : 'filled'
                        }
                      />
                    </Box>
                  </li>
                )
              }}
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
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        maxWidth="xs"
        fullWidth
        aria-label="Provision new delegate"
      >
        <DialogTitle>Provision new delegate</DialogTitle>
        <DialogContent>
          {provisionGuard && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {provisionGuard}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Creates a delegate account for this system. No email is sent; the
            person signs in through the usual login.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              variant="standard"
              required
              value={provisionName}
              onChange={(e) => setProvisionName(e.target.value)}
              error={!!provisionErrors.fullname}
              helperText={provisionErrors.fullname}
              InputLabelProps={{ sx: { marginTop: 0 } }}
            />
            <TextField
              label="Email"
              variant="standard"
              required
              value={provisionEmail}
              onChange={(e) => setProvisionEmail(e.target.value)}
              error={!!provisionErrors.email}
              helperText={provisionErrors.email}
              InputLabelProps={{ sx: { marginTop: 0 } }}
            />
            <TextField
              label="Access expires"
              type="date"
              variant="standard"
              required
              value={provisionExpiry}
              onChange={(e) => setProvisionExpiry(e.target.value)}
              error={!!provisionErrors.access_expires_at}
              helperText={
                provisionErrors.access_expires_at ??
                'Defaults to three months from today'
              }
              InputLabelProps={{ shrink: true, sx: { marginTop: 0 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <CmsButton
            onClick={() => setProvisionOpen(false)}
            disabled={provisioning}
          >
            Cancel
          </CmsButton>
          <CmsButton onClick={handleProvision} disabled={provisioning}>
            {provisioning ? 'Provisioning...' : 'Provision'}
          </CmsButton>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
