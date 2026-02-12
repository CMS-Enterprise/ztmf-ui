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
import { getFieldsBySection, FieldConfig } from './fieldConfig'

interface SystemDetailReadViewProps {
  system: FismaSystemType
  decommissionedByName: string
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
}: SystemDetailReadViewProps) {
  const identityFields = getFieldsBySection('identity')
  const orgFields = getFieldsBySection('organization')
  const contactFields = getFieldsBySection('contacts')

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
      <Grid item xs={12} md={5}>
        <Card
          variant="outlined"
          sx={{ mb: 3, borderColor: system.decommissioned ? 'error.main' : undefined }}
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
        <Card variant="outlined">
          <CardHeader
            title="Organization"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>{renderFields(orgFields, system)}</CardContent>
        </Card>
      </Grid>

      {/* Contacts */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Contacts"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {renderFields(contactFields, system)}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
