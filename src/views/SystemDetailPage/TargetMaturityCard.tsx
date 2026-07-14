import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { FismaSystemType } from '@/types'
import axiosInstance from '@/axiosConfig'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import {
  CONFIRMATION_MESSAGE,
  ERROR_MESSAGES,
  STATUS_MESSAGES,
} from '@/constants'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
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
  /**
   * Whether the current user may edit target maturity for this system.
   * Admins and assigned ISSOs both qualify; the backend re-checks on
   * write. Gates only the "Edit" button - view mode is universal.
   */
  canEdit: boolean
  /**
   * Fired after a successful save so the parent can update its
   * fismaSystems context with the new target_maturity_* values.
   */
  onSaved: (updated: FismaSystemType) => void
}

/**
 * Card for the system's risk-based target maturity level.
 *
 * Owns its own view / edit / save lifecycle independently of the
 * page-level Edit button. An ISSO who is otherwise not allowed to edit
 * the system form can still update the target maturity here; an admin
 * can bump it without entering full-page Edit mode. Saves fire
 * `PUT /fismasystems/:id/target-maturity` which validates only the
 * tier + justification, so blank required fields elsewhere on the page
 * never block a target-maturity change.
 */
export default function TargetMaturityCard({
  system,
  canEdit,
  onSaved,
}: TargetMaturityCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tier, setTier] = useState(
    system.target_maturity_tier ?? DEFAULT_TARGET_TIER
  )
  const [justification, setJustification] = useState(
    system.target_maturity_justification ?? ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false)

  const hasExplicitTarget = !!system.target_maturity_tier
  const trimmedJustification = justification.trim()
  const justificationTooLong =
    trimmedJustification.length > TARGET_JUSTIFICATION_MAX
  const justificationMissing = isEditing && trimmedJustification.length === 0

  // The draft counts as touched when it differs from what's stored;
  // NULL stored renders as the Advanced default with empty justification.
  const isDirty =
    tier !== (system.target_maturity_tier ?? DEFAULT_TARGET_TIER) ||
    trimmedJustification !== (system.target_maturity_justification ?? '')

  // Justification is required on every dirty save (GAO deliverable) and
  // must fit under the max. An untouched draft is trivially valid because
  // the Save button short-circuits before firing.
  const isSavable =
    isDirty &&
    trimmedJustification.length > 0 &&
    !justificationTooLong &&
    !isSaving

  const seedFromSystem = () => {
    setTier(system.target_maturity_tier ?? DEFAULT_TARGET_TIER)
    setJustification(system.target_maturity_justification ?? '')
  }

  const handleEdit = () => {
    seedFromSystem()
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (isDirty) {
      setOpenConfirmDialog(true)
    } else {
      setIsEditing(false)
    }
  }

  const handleConfirmDiscard = (confirm: boolean) => {
    setOpenConfirmDialog(false)
    if (confirm) {
      seedFromSystem()
      setIsEditing(false)
    }
  }

  const handleSave = async () => {
    if (!isSavable) return
    setIsSaving(true)
    try {
      const res = await axiosInstance.put(
        `fismasystems/${system.fismasystemid}/target-maturity`,
        {
          target_maturity_tier: tier,
          target_maturity_justification: trimmedJustification,
        }
      )
      const saved = (res.data?.data ?? null) as FismaSystemType | null
      if (saved) onSaved(saved)
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      setIsEditing(false)
    } catch (error) {
      if (isAuthHandled(error)) return
      const parsed = parseApiError(error)
      notify(parsed.message || ERROR_MESSAGES.error, 'error', {
        autoHideDuration: 2000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader
          title="Target Maturity Level"
          titleTypographyProps={{ variant: 'h6' }}
          subheader="Risk-based target this system's answers are compared against"
          action={
            canEdit && !isEditing ? (
              <Button size="small" onClick={handleEdit}>
                Edit
              </Button>
            ) : undefined
          }
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
                onChange={(e) => setTier(e.target.value)}
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
                onChange={(e) => setJustification(e.target.value)}
                helperText={
                  justificationTooLong
                    ? `Must be ${TARGET_JUSTIFICATION_MAX} characters or fewer`
                    : JUSTIFICATION_HELPER
                }
                error={justificationTooLong || justificationMissing}
                InputLabelProps={{ sx: { marginTop: 0 } }}
                inputProps={{ 'aria-label': 'Justification' }}
              />
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  onClick={handleCancel}
                  disabled={isSaving}
                  color="inherit"
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!isSavable}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </Box>
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
      <ConfirmDialog
        confirmationText={CONFIRMATION_MESSAGE}
        open={openConfirmDialog}
        onClose={() => setOpenConfirmDialog(false)}
        confirmClick={handleConfirmDiscard}
      />
    </>
  )
}
