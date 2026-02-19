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
import { CfactsSystemType } from '@/types'
import axiosInstance from '@/axiosConfig'

interface CfactsRecordCardProps {
  fismaUid: string
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
  const [year, month, day] = dateStr.split('-').map(Number)
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
  return parseDate(dateStr).toLocaleDateString()
}

export default function CfactsRecordCard({ fismaUid }: CfactsRecordCardProps) {
  const [cfacts, setCfacts] = useState<CfactsSystemType | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setHasError(false)

    axiosInstance
      .get(`cfactssystems/${fismaUid}`)
      .then((res) => {
        if (!cancelled) {
          setCfacts(res.data?.data ?? res.data)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (
            error.response?.status === 404 ||
            error.response?.status === 403
          ) {
            setNotFound(true)
          } else {
            setHasError(true)
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
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
        Failed to load CFACTS data. Please try again.
      </Typography>
    )
  }

  if (notFound || !cfacts) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        No CFACTS record found.
      </Typography>
    )
  }

  const atoColor = getAtoColor(cfacts.ato_expiration_date)

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
              value={cfacts.authorization_package_name}
            />
            <FieldDisplay label="Acronym" value={cfacts.fisma_acronym} />
            <FieldDisplay label="FISMA UUID" value={cfacts.fisma_uuid} />
            <FieldDisplay label="Component" value={cfacts.component_acronym} />
            <FieldDisplay
              label="Lifecycle Phase"
              value={cfacts.lifecycle_phase}
            />
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
              <BooleanChip label="Active" value={cfacts.is_active} />
              <BooleanChip label="Retired" value={cfacts.is_retired} />
              <BooleanChip
                label="Decommissioned"
                value={cfacts.is_decommissioned}
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
                {formatDate(cfacts.ato_expiration_date) || '—'}
              </Typography>
            </Box>
            {cfacts.decommission_date && (
              <FieldDisplay
                label="Decommission Date"
                value={formatDate(cfacts.decommission_date)}
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
            <FieldDisplay label="Group Name" value={cfacts.group_name} />
            <FieldDisplay label="Division Name" value={cfacts.division_name} />
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
                  value={cfacts.primary_isso_name}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldDisplay
                  label="Primary ISSO Email"
                  value={cfacts.primary_isso_email}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Footer: sync info */}
      <Grid item xs={12}>
        <Typography variant="caption" color="text.secondary">
          Data as of: {new Date(cfacts.synced_at).toLocaleString()}
          {cfacts.last_modified_date &&
            ` · Last modified in CFACTS: ${formatDate(cfacts.last_modified_date)}`}
        </Typography>
      </Grid>
    </Grid>
  )
}
