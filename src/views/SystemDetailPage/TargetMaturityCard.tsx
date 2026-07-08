import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { FismaSystemType } from '@/types'
import {
  TIER_OPTIONS,
  DEFAULT_TARGET_TIER,
  TARGET_JUSTIFICATION_MAX,
} from './targetMaturityConfig'

const JUSTIFICATION_HELPER =
  'In one sentence, explain why this target level is appropriate for this system.'

function tierLabel(tier: string): string {
  return TIER_OPTIONS.find((o) => o.value === tier)?.label ?? tier
}

interface TargetMaturityCardProps {
  system: FismaSystemType
  /** Controlled by the page-level Edit button (ztmf#398 change request):
   * true only while the page is in edit mode AND the user may write the
   * target (admin or assigned ISSO). */
  isEditing: boolean
  tier: string
  justification: string
  onTierChange: (tier: string) => void
  onJustificationChange: (justification: string) => void
}

/**
 * Card for the system's risk-based target maturity level (ztmf#398).
 * Fully controlled: edit state and the Save action live with the page's
 * single Edit/Save flow. The page decides who may edit (assigned ISSOs get
 * only this card unlocked; admins get the full form as well) and PUTs to
 * the dedicated /target-maturity endpoint on save.
 */
export default function TargetMaturityCard({
  system,
  isEditing,
  tier,
  justification,
  onTierChange,
  onJustificationChange,
}: TargetMaturityCardProps) {
  const hasExplicitTarget = !!system.target_maturity_tier
  const justificationTooLong = justification.length > TARGET_JUSTIFICATION_MAX
  // Required once the draft differs from what's stored; the page-level
  // isFormValid applies the same rule to gate Save.
  const justificationMissing = isEditing && justification.trim().length === 0

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardHeader
        title="Target Maturity Level"
        titleTypographyProps={{ variant: 'h6' }}
        subheader="Risk-based target this system's answers are compared against"
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 0 }}>
        {isEditing ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              maxWidth: 640,
            }}
          >
            {/* variant="standard" + marginTop:0 on the label matches
                SystemDetailEditView: the CMS design-system global CSS breaks
                MUI's outlined floating label (it overlays the value). */}
            <TextField
              select
              label="Target level"
              variant="standard"
              value={tier}
              onChange={(e) => onTierChange(e.target.value)}
              InputLabelProps={{ sx: { marginTop: 0 } }}
              inputProps={{ 'aria-label': 'Target level' }}
            >
              {TIER_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Justification"
              variant="standard"
              required
              multiline
              minRows={2}
              value={justification}
              onChange={(e) => onJustificationChange(e.target.value)}
              helperText={
                justificationTooLong
                  ? `Must be ${TARGET_JUSTIFICATION_MAX} characters or fewer`
                  : JUSTIFICATION_HELPER
              }
              error={justificationTooLong || justificationMissing}
              InputLabelProps={{ sx: { marginTop: 0 } }}
              inputProps={{ 'aria-label': 'Justification' }}
            />
          </Box>
        ) : (
          <Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}
            >
              <Chip
                label={tierLabel(
                  system.target_maturity_tier ?? DEFAULT_TARGET_TIER
                )}
                color="primary"
                size="small"
              />
              {!hasExplicitTarget && (
                <Typography variant="caption" color="text.secondary">
                  Default — no target has been set for this system yet
                </Typography>
              )}
            </Box>
            {hasExplicitTarget && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Justification
                </Typography>
                <Typography variant="body1">
                  {system.target_maturity_justification || '—'}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
