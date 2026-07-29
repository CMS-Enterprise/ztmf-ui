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
import {
  formatBool,
  formatList,
  isCrossFieldHidden,
} from '@/utils/systemMetadataVocab'

interface SystemDetailReadViewProps {
  system: FismaSystemType
  decommissionedByName: string
  // Rendered in the right column between Data Lake Export and Organization.
  // The page owns the card so its edit state is independent of this view.
  targetMaturitySlot?: ReactNode
  opdivName: string | null
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

/**
 * Read-view display string for a field, keyed off its configured type:
 * tri-state booleans read as Yes/No/Unknown and decomposed multi-selects as a
 * comma list, so the raw "true"/array shapes never leak to the page. Text,
 * email, and single selects fall through to their stored string.
 *
 * @param field - The field being rendered.
 * @param system - The system whose value to format.
 * @returns The display string (empty string when unset; FieldDisplay shows the placeholder).
 */
function formatFieldValue(field: FieldConfig, system: FismaSystemType): string {
  const raw = system[field.key]
  if (field.type === 'boolean')
    return formatBool(raw as boolean | null, field.booleanLabels)
  if (field.type === 'multiselect') return formatList(raw as string[] | null)
  return String(raw ?? '')
}

function renderFields(fields: FieldConfig[], system: FismaSystemType) {
  return fields.map((field) => (
    <FieldDisplay
      key={field.key}
      label={field.label}
      value={formatFieldValue(field, system)}
    />
  ))
}

export default function SystemDetailReadView({
  system,
  decommissionedByName,
  targetMaturitySlot,
  opdivName,
}: SystemDetailReadViewProps) {
  const identityFields = getFieldsBySection('identity')
  const orgFields = getFieldsBySection('organization')
  const contactFields = getFieldsBySection('contacts')
  // cloud_service_model and cloud_vendor do not apply to a non-cloud system, so
  // they are hidden here just as the edit view hides them when cloud_system is
  // No (they are empty in that case anyway).
  const extendedFields = getFieldsBySection('extended').filter(
    (field) => !isCrossFieldHidden(field.key, system)
  )
  // Only show the Extended Metadata card when at least one field is populated.
  // Systems without extended metadata have every field null and would otherwise
  // render an empty card. (Read view is not role-gated; the values are the
  // system's own metadata, visible to anyone who can view the system.)
  const hasAnyExtendedData = extendedFields.some((field) => {
    const raw = system[field.key]
    if (raw == null || raw === '') return false
    if (Array.isArray(raw)) return raw.length > 0
    return true
  })

  return (
    <Grid container spacing={3}>
      {/* Left column: System Identity, then Contacts. Contacts fills the
          vertical space the taller right column would otherwise leave blank. */}
      <Grid
        item
        xs={12}
        md={7}
        sx={{ display: 'flex', flexDirection: 'column' }}
      >
        <Card variant="outlined" sx={{ mb: 3 }}>
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
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardHeader
            title="Contacts"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              {contactFields.map((field) => (
                <Grid item xs={12} key={field.key}>
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
          <CardContent>
            <FieldDisplay label="OpDiv" value={opdivName} />
            {renderFields(orgFields, system)}
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
                      value={formatFieldValue(field, system)}
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
