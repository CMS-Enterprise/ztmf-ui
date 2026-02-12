import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Box,
  Alert,
  Chip,
} from '@mui/material'
import { FismaSystemType } from '@/types'
import { getFieldsBySection, FieldConfig } from './fieldConfig'

interface SystemDetailReadViewProps {
  system: FismaSystemType
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
            sx={{ pb: 0 }}
          />
          <CardContent>{renderFields(identityFields, system)}</CardContent>
        </Card>
      </Grid>

      {/* Organization */}
      <Grid item xs={12} md={5}>
        <Card variant="outlined">
          <CardHeader
            title="Organization"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>{renderFields(orgFields, system)}</CardContent>
        </Card>
      </Grid>

      {/* Contacts & Status */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Contacts & Status"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {renderFields(contactFields, system)}
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    System Status
                  </Typography>
                  {system.decommissioned ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Decommissioned
                      {system.decommissioned_date &&
                        ` on ${new Date(system.decommissioned_date).toLocaleDateString()}`}
                      {system.decommissioned_by && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          By: {system.decommissioned_by}
                        </Typography>
                      )}
                      {system.decommissioned_notes && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Notes: {system.decommissioned_notes}
                        </Typography>
                      )}
                    </Alert>
                  ) : (
                    <Box sx={{ mt: 1 }}>
                      <Chip label="Active" color="success" size="small" />
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
