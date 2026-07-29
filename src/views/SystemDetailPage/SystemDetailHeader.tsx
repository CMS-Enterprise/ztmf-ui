import { Box, Typography, IconButton } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Button as CmsButton } from '@cmsgov/design-system'
import { useNavigate } from 'react-router-dom'

interface SystemDetailHeaderProps {
  systemName: string
  /** Drives the Questionnaire link; the questionnaire route is keyed on the
   * acronym, not the fismasystemid this page is routed by (ui#609). */
  fismaacronym: string
  /** Admins edit the whole form; an assigned ISSO gets the same Edit button
   * but only the target-maturity card unlocks for them (ztmf#398). */
  canEdit: boolean
  isEditing: boolean
  isSaving: boolean
  isFormValid: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function SystemDetailHeader({
  systemName,
  fismaacronym,
  canEdit,
  isEditing,
  isSaving,
  isFormValid,
  onEdit,
  onSave,
  onCancel,
}: SystemDetailHeaderProps) {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          onClick={() => navigate('/')}
          aria-label="Back to dashboard"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">{systemName}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {isEditing ? (
          <>
            <CmsButton
              variation="solid"
              onClick={onSave}
              disabled={!isFormValid || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </CmsButton>
            <CmsButton onClick={onCancel} disabled={isSaving}>
              Cancel
            </CmsButton>
          </>
        ) : (
          <>
            {/* Cross-navigation to this system's questionnaire (ui#609). No
                route state: QuestionnairePage falls back to the selected/latest
                data call when location.state carries no datacallid, which is
                the right default arriving from here, and it keeps the target a
                plain shareable URL. Rendered only outside edit mode so a dirty
                form keeps Save/Cancel as its only actions. A decommissioned
                system links too and the questionnaire's own
                "no questionnaire is available" alert explains the outcome. */}
            <CmsButton
              onClick={() =>
                navigate(`/questionnaire/${fismaacronym.toLowerCase()}`)
              }
            >
              Questionnaire
            </CmsButton>
            {canEdit && (
              <CmsButton variation="solid" onClick={onEdit}>
                Edit
              </CmsButton>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}
