import { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Box,
  Chip,
} from '@mui/material'
import { FismaSystemType } from '@/types'
import {
  SDL_SYNC_DESCRIPTION_ON,
  SDL_SYNC_DESCRIPTION_OFF,
  EXTENDED_METADATA_TITLE,
  EXTENDED_METADATA_SUBHEADER,
} from '@/constants'
import { getFieldsBySection, FieldConfig } from './fieldConfig'

interface SystemDetailReadViewProps {
  system: FismaSystemType
  decommissionedByName: string
  // Rendered in the right column between Data Lake Export and Organization.
  // The page owns it (its edit state is independent of this view) and slots it
  // here so it sits with the other system cards (ztmf#398).
  targetMaturitySlot?: ReactNode
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
      <Typography variant="body1">{value || '—'}</Typography>
    </Box>
  )
}

function renderFields(fields: FieldConfig[], system: FismaSystemType) {
  return fields.map((field) => (
    <FieldDisplay
      key={field.key}
      label={field.label}
      value={String(system[field.key] ?? '')}
    />
  ))
}

export default function SystemDetailReadView({
  system,
  decommissionedByName,
  targetMaturitySlot,
}: SystemDetailReadViewProps) {
  const identityFields = getFieldsBySection('identity')
  const orgFields = getFieldsBySection('organization')
  const contactFields = getFieldsBySection('contacts')
  const extendedFields = getFieldsBySection('extended')
  // Only show the Extended Metadata card when at least one field is populated.
  // Systems without extended metadata have every field null and would otherwise
  // render an empty card. (Read view is not role-gated; the values are the
  // system's own metadata, visible to anyone who can view the system.)
  const hasAnyExtendedData = extendedFields.some(
    (field) => system[field.key] != null && system[field.key] !== ''
  )

  return (
    <Grid container spacing={3}>
      {/* System Identity */}
      <Grid item xs={12} md={7}>
        <Card variant="outlined">
          <CardHeader
            title="System Identity"
            titleTypographyProps={{ variant: 'h6' }}
            action={
              system.decommissioned ? (
                <Chip label="Decommissioned" color="error" size="small" />
              ) : (
                <Chip label="Active" color="success" size="small" />
              )
            }
            sx={{ pb: 0 }}
          />
          <CardContent>{renderFields(identityFields, system)}</CardContent>
        </Card>
      </Grid>

      {/* Right column: Status + Organization */}
      <Grid
        item
        xs={12}
        md={5}
        sx={{ display: 'flex', flexDirection: 'column' }}
      >
        <Card
          variant="outlined"
          sx={{
            mb: 3,
            borderColor: system.decommissioned ? 'error.main' : undefined,
          }}
        >
          <CardHeader
            title="System Status"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            {system.decommissioned ? (
              <>
                {system.decommissioned_date && (
                  <FieldDisplay
                    label="Decommissioned On"
                    value={new Date(
                      system.decommissioned_date
                    ).toLocaleDateString()}
                  />
                )}
                {system.decommissioned_by && (
                  <FieldDisplay
                    label="Decommissioned By"
                    value={decommissionedByName || system.decommissioned_by}
                  />
                )}
                {system.decommissioned_notes && (
                  <FieldDisplay
                    label="Notes"
                    value={system.decommissioned_notes}
                  />
                )}
              </>
            ) : (
              <Typography variant="body1" sx={{ color: 'success.main' }}>
                This system is active.
              </Typography>
            )}
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardHeader
            title="Data Lake Export"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                SDL Sync
              </Typography>
              {system.sdl_sync_enabled === null ? (
                <Chip
                  label="Not configured"
                  size="small"
                  color="default"
                  variant="outlined"
                />
              ) : system.sdl_sync_enabled ? (
                <Chip
                  label="On"
                  size="small"
                  color="primary"
                  variant="filled"
                />
              ) : (
                <Chip
                  label="Off"
                  size="small"
                  color="default"
                  variant="outlined"
                />
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}
            >
              {system.sdl_sync_enabled === null
                ? 'SDL sync has not been configured for this system.'
                : system.sdl_sync_enabled
                  ? SDL_SYNC_DESCRIPTION_ON
                  : SDL_SYNC_DESCRIPTION_OFF}
            </Typography>
          </CardContent>
        </Card>
        {targetMaturitySlot}
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardHeader
            title="Organization"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>{renderFields(orgFields, system)}</CardContent>
        </Card>
      </Grid>

      {/* Contacts — full width, fields horizontal */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Contacts"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              {contactFields.map((field) => (
                <Grid item xs={12} sm={6} key={field.key}>
                  <FieldDisplay
                    label={field.label}
                    value={String(system[field.key] ?? '')}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Extended Metadata — full width, 3-col grid. Hidden entirely when the
          system has no extended metadata fields populated. */}
      {hasAnyExtendedData && (
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardHeader
              title={EXTENDED_METADATA_TITLE}
              titleTypographyProps={{ variant: 'h6' }}
              subheader={EXTENDED_METADATA_SUBHEADER}
              subheaderTypographyProps={{ variant: 'caption' }}
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Grid container spacing={3}>
                {extendedFields.map((field) => (
                  <Grid item xs={12} sm={6} md={4} key={field.key}>
                    <FieldDisplay
                      label={field.label}
                      value={String(system[field.key] ?? '')}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}
