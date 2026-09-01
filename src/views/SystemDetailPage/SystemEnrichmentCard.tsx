import { useState, useEffect } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material'
import {
  EnrichmentContact,
  FismaSystemType,
  SystemEnrichmentType,
} from '@/types'
import axiosInstance from '@/axiosConfig'
import { STATUS_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'

interface SystemEnrichmentCardProps {
  fismaUid: string
  /**
   * The system's own datacenterenvironment value, for comparison against the
   * CFACTS-reported one in the enrichment payload (ztmf#239). When they
   * disagree, the card flags the difference.
   */
  systemDataCenterEnvironment?: string | null
  /**
   * The fisma system this page shows (ztmf-ui#720). Its issoemail/isso_name
   * are ZTMF's system-of-record ISSO, compared against the CFACTS primary
   * from the enrichment roster; when either side is missing the comparison is
   * skipped - absence is unknown, not disagreement. The full object is needed
   * (not just the ISSO pair) because the admin "update ZTMF to match" action
   * must echo every core field on the PUT - the backend zeroes omitted core
   * fields rather than leaving them unchanged.
   */
  system?: FismaSystemType
  isAdmin?: boolean
  /** Called after a successful ISSO update so the parent can refetch. */
  onIssoUpdated?: () => void | Promise<void>
}

// CFACTS role display order (ztmf-ui#720). The pipeline emits the array in
// this order already, but sort defensively; unknown roles keep their arrival
// order after the known ones rather than being dropped.
const CONTACT_ROLE_ORDER = [
  'Primary ISSO',
  'ISSO',
  'ISSOCS',
  'BO',
  'SDM',
  'Primary CRA',
  'CRA',
]

// Friendly section labels for role codes that read poorly on their own.
// Matching stays on the exact pipeline strings; this is display-only.
const CONTACT_ROLE_LABELS: Record<string, string> = {
  BO: 'Business Owner',
}

// The payload is pipeline-owned jsonb: coerce every field through this so an
// absent/null/non-string value renders as nothing, never as "undefined".
function asStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function sortContacts(contacts: EnrichmentContact[]): EnrichmentContact[] {
  const rank = (c: EnrichmentContact) => {
    const idx = CONTACT_ROLE_ORDER.indexOf(asStr(c.role) ?? '')
    return idx === -1 ? CONTACT_ROLE_ORDER.length : idx
  }
  return contacts
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c)
}

// Name comparison is the fallback signal when an email is missing on either
// side, and the two sources use different formats ("Last, First" vs
// "First Last"), so compare as an order-insensitive word set.
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

function FieldDisplay({
  label,
  value,
}: {
  label: string
  value: string | undefined | null
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Box>
  )
}

function BooleanChip({
  label,
  value,
}: {
  label: string
  value: boolean | null
}) {
  if (value === null) {
    return <Chip label={`${label}: Unknown`} size="small" />
  }
  return (
    <Chip
      label={`${label}: ${value ? 'Yes' : 'No'}`}
      color={value ? 'success' : 'default'}
      size="small"
    />
  )
}

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split(/[ T]/)[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getAtoColor(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined
  const expiration = parseDateOnly(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (expiration < now) return 'error.main'
  const ninetyDays = new Date()
  ninetyDays.setHours(0, 0, 0, 0)
  ninetyDays.setDate(ninetyDays.getDate() + 90)
  if (expiration <= ninetyDays) return 'warning.main'
  return undefined
}

function parseDate(dateStr: string): Date {
  if (dateStr.includes('T')) return new Date(dateStr)
  return parseDateOnly(dateStr)
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const date = parseDate(dateStr)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString()
}

// normalizeDCE mirrors the backend report's comparison (ztmf#239): trimmed,
// case-insensitive, with null/undefined and "" both meaning "no value".
function normalizeDCE(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export default function SystemEnrichmentCard({
  fismaUid,
  systemDataCenterEnvironment,
  system,
  isAdmin,
  onIssoUpdated,
}: SystemEnrichmentCardProps) {
  const [enrichment, setEnrichment] = useState<SystemEnrichmentType | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [updatingIsso, setUpdatingIsso] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setNotFound(false)
    setHasError(false)

    // ZTMF Insights treats 403 as "no record for this OpDiv" and renders
    // an empty state. Bypass the cross-cutting auth handler so it does
    // not surface a permission snackbar over what is a normal absent-data
    // case.
    async function load() {
      try {
        const res = await axiosInstance.get(`systemenrichment/${fismaUid}`, {
          signal: controller.signal,
          skipAuthHandling: true,
        })
        // The endpoint returns { data: { fisma_uuid, payload, synced_at } }.
        // The enrichment fields live in payload; fisma_uuid and synced_at are
        // top-level siblings. Flatten into the existing shape so the rendering
        // below is unchanged.
        const record = res.data?.data
        setEnrichment(
          record
            ? {
                ...record.payload,
                fisma_uuid: record.fisma_uuid,
                synced_at: record.synced_at,
              }
            : null
        )
      } catch (error) {
        if (controller.signal.aborted) return
        const status = (error as { response?: { status?: number } }).response
          ?.status
        if (status === 404 || status === 403) {
          if (status === 403) {
            console.warn('ZTMF Insights 403 for fismaUid:', fismaUid)
          }
          setNotFound(true)
        } else {
          setHasError(true)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()

    return () => {
      controller.abort()
    }
  }, [fismaUid])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={40} />
      </Box>
    )
  }

  if (hasError) {
    return (
      <Typography variant="body2" color="error" sx={{ mt: 1 }}>
        Failed to load ZTMF Insights data. Please try again.
      </Typography>
    )
  }

  if (notFound || !enrichment) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        No ZTMF Insights data found.
      </Typography>
    )
  }

  const atoColor = getAtoColor(enrichment.ato_expiration_date)

  // Flag when CFACTS reports a data center environment that disagrees with the
  // system's own value - including when ZTMF has none recorded, which is drift
  // worth surfacing, same as the backend /datacentermismatches report.
  const cfactsDCE = enrichment.data_center_environment
  const dceMismatch =
    normalizeDCE(cfactsDCE) !== '' &&
    normalizeDCE(cfactsDCE) !== normalizeDCE(systemDataCenterEnvironment)

  // Full CFACTS roster (ztmf-ui#720). Absent on pre-rollout payloads and on
  // systems with no CFACTS roster - the primary_isso_* pair is the fallback
  // display, not an edge case.
  const contacts = sortContacts(
    (Array.isArray(enrichment.contacts) ? enrichment.contacts : []).filter(
      (c): c is EnrichmentContact =>
        !!c &&
        typeof c === 'object' &&
        (asStr(c.role) !== null ||
          asStr(c.name) !== null ||
          asStr(c.email) !== null)
    )
  )

  // One section per role, in canonical order (contacts is already sorted), so
  // multiple ISSOs/CRAs stack under a single role label instead of repeating
  // it per person.
  const contactSections: { role: string; entries: EnrichmentContact[] }[] = []
  for (const contact of contacts) {
    const role = asStr(contact.role) ?? 'Contact'
    const section = contactSections.find((s) => s.role === role)
    if (section) {
      section.entries.push(contact)
    } else {
      contactSections.push({ role, entries: [contact] })
    }
  }

  // CFACTS primary ISSO: the exact 'Primary ISSO' roster entry, else the
  // legacy flat keys (which the pipeline derives from the same entry when a
  // roster exists). The pair is resolved atomically from ONE source - a roster
  // entry missing its email must not borrow the flat email key, or a name and
  // an email belonging to different people could be blended into one person.
  const primaryContact = contacts.find((c) => c.role === 'Primary ISSO')
  const cfactsIssoName = primaryContact
    ? asStr(primaryContact.name)
    : asStr(enrichment.primary_isso_name)
  const cfactsIssoEmail = primaryContact
    ? asStr(primaryContact.email)
    : asStr(enrichment.primary_isso_email)

  // Emails are the primary signal; names only when an email is missing on
  // either side. Missing data on a side means unknown, never a mismatch.
  const ztmfEmail = asStr(system?.issoemail)
  const ztmfName = asStr(system?.isso_name)
  let issoMismatch = false
  if (ztmfEmail && cfactsIssoEmail) {
    issoMismatch =
      ztmfEmail.trim().toLowerCase() !== cfactsIssoEmail.trim().toLowerCase()
  } else if (ztmfName && cfactsIssoName) {
    issoMismatch = normalizeName(ztmfName) !== normalizeName(cfactsIssoName)
  }

  const formatPerson = (name: string | null, email: string | null) =>
    name && email ? `${name} (${email})` : name ?? email ?? ''

  const handleAdoptCfactsIsso = async () => {
    if (!system || !cfactsIssoEmail || updatingIsso) return
    setUpdatingIsso(true)
    try {
      // Echo EVERY core field, exactly like the page's handleSave. "Omitted
      // means leave unchanged" only holds for the extended pointer fields on
      // this PUT - omitted core fields are written back as zero values, so a
      // partial payload silently blanks the system. Extended fields are all
      // omitted (no diff to send). isso_name too: a written name becomes a
      // permanent stored override (see FismaSystemType), and CFACTS names
      // arrive in "Last, First" - the backend resolves the display name from
      // the new ISSO's user record instead.
      await axiosInstance.put(`fismasystems/${system.fismasystemid}`, {
        fismauid: system.fismauid,
        fismaacronym: system.fismaacronym,
        fismaname: system.fismaname,
        fismasubsystem: system.fismasubsystem,
        component: system.component,
        groupacronym: system.groupacronym,
        groupname: system.groupname,
        divisionname: system.divisionname,
        datacenterenvironment: system.datacenterenvironment,
        datacallcontact: system.datacallcontact,
        issoemail: cfactsIssoEmail,
        sdl_sync_enabled: system.sdl_sync_enabled,
      })
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      await onIssoUpdated?.()
    } catch (error) {
      if (isAuthHandled(error)) return
      notify(STATUS_MESSAGES.notSaved, 'error', { autoHideDuration: 1500 })
    } finally {
      setUpdatingIsso(false)
    }
  }

  return (
    <Grid container spacing={3}>
      {/* Row 1: Identity, Status, Organization — 3 across on md+ */}
      <Grid item xs={12} md={5}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardHeader
            title="System Identity"
            titleTypographyProps={{ variant: 'subtitle1' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <FieldDisplay
              label="Package Name"
              value={enrichment.authorization_package_name}
            />
            <FieldDisplay label="Acronym" value={enrichment.fisma_acronym} />
            <FieldDisplay label="FISMA UUID" value={enrichment.fisma_uuid} />
            <FieldDisplay
              label="Component"
              value={enrichment.component_acronym}
            />
            <FieldDisplay
              label="Lifecycle Phase"
              value={enrichment.lifecycle_phase}
            />
            <FieldDisplay label="Data Center Environment" value={cfactsDCE} />
            {dceMismatch && (
              <Chip
                label={`Differs from ZTMF: ${systemDataCenterEnvironment?.trim() || 'not set'}`}
                color="warning"
                size="small"
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardHeader
            title="Status"
            titleTypographyProps={{ variant: 'subtitle1' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <BooleanChip label="Active" value={enrichment.is_active} />
              <BooleanChip label="Retired" value={enrichment.is_retired} />
              <BooleanChip
                label="Decommissioned"
                value={enrichment.is_decommissioned}
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                ATO Expiration
              </Typography>
              <Typography
                variant="body1"
                sx={atoColor ? { color: atoColor } : undefined}
              >
                {formatDate(enrichment.ato_expiration_date) || '—'}
              </Typography>
            </Box>
            {enrichment.decommission_date && (
              <FieldDisplay
                label="Decommission Date"
                value={formatDate(enrichment.decommission_date)}
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardHeader
            title="Organization"
            titleTypographyProps={{ variant: 'subtitle1' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <FieldDisplay
              label="Group Acronym"
              value={enrichment.group_acronym}
            />
            <FieldDisplay label="Group Name" value={enrichment.group_name} />
            <FieldDisplay
              label="Division Name"
              value={enrichment.division_name}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Row 2: Contacts — full width, fields horizontal */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Contacts"
            titleTypographyProps={{ variant: 'subtitle1' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            {contactSections.length > 0 ? (
              <Grid container spacing={3}>
                {contactSections.map(({ role, entries }) => (
                  <Grid item xs={12} sm={6} md={4} key={role}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="div"
                    >
                      {CONTACT_ROLE_LABELS[role] ?? role}
                    </Typography>
                    {entries.map((contact, idx) => {
                      const name = asStr(contact.name)
                      const email = asStr(contact.email)
                      return (
                        <Box
                          key={idx}
                          sx={idx < entries.length - 1 ? { mb: 1 } : undefined}
                        >
                          <Typography
                            variant="body1"
                            sx={{ wordBreak: 'break-word' }}
                          >
                            {name ?? email ?? '—'}
                          </Typography>
                          {name && email && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ wordBreak: 'break-word' }}
                            >
                              {email}
                            </Typography>
                          )}
                        </Box>
                      )
                    })}
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FieldDisplay
                    label="Primary ISSO Name"
                    value={enrichment.primary_isso_name}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FieldDisplay
                    label="Primary ISSO Email"
                    value={enrichment.primary_isso_email}
                  />
                </Grid>
              </Grid>
            )}
            {/* The live region stays mounted and only its contents change:
                a region inserted into the DOM at the same moment as its text
                is generally not announced (same pattern as FismaTable's
                call-scope notice). */}
            <Box role="status" aria-live="polite">
              {issoMismatch && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <AlertTitle>
                    ZTMF assigned ISSO does not match CFACTS
                  </AlertTitle>
                  <Typography variant="body2">
                    ZTMF assigned ISSO: {formatPerson(ztmfName, ztmfEmail)}
                  </Typography>
                  <Typography variant="body2">
                    CFACTS primary ISSO:{' '}
                    {formatPerson(cfactsIssoName, cfactsIssoEmail)}
                  </Typography>
                  {isAdmin && system && cfactsIssoEmail && (
                    <Button
                      type="button"
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={handleAdoptCfactsIsso}
                      disabled={updatingIsso}
                      sx={{ mt: 1 }}
                    >
                      Update ZTMF to match CFACTS
                    </Button>
                  )}
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Footer: sync info. The id anchors the frostfall system-detail scan's
          waitFor - it only exists once the enrichment payload has rendered. */}
      <Grid item xs={12}>
        <Typography
          id="enrichment-synced-at"
          variant="caption"
          color="text.secondary"
        >
          Data as of: {new Date(enrichment.synced_at).toLocaleString()}
          {enrichment.last_modified_date &&
            ` · Last modified in CFACTS: ${formatDate(enrichment.last_modified_date)}`}
        </Typography>
      </Grid>
    </Grid>
  )
}
