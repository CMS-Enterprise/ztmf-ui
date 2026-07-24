import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material'
import { SystemEnrichmentType } from '@/types'
import axiosInstance from '@/axiosConfig'

interface SystemEnrichmentCardProps {
  fismaUid: string
  /**
   * The system's own datacenterenvironment value, for comparison against the
   * CFACTS-reported one in the enrichment payload (ztmf#239). When they
   * disagree, the card flags the difference.
   */
  systemDataCenterEnvironment?: string | null
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
}: SystemEnrichmentCardProps) {
  const [enrichment, setEnrichment] = useState<SystemEnrichmentType | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hasError, setHasError] = useState(false)

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
          </CardContent>
        </Card>
      </Grid>

      {/* Footer: sync info */}
      <Grid item xs={12}>
        <Typography variant="caption" color="text.secondary">
          Data as of: {new Date(enrichment.synced_at).toLocaleString()}
          {enrichment.last_modified_date &&
            ` · Last modified in CFACTS: ${formatDate(enrichment.last_modified_date)}`}
        </Typography>
      </Grid>
    </Grid>
  )
}
