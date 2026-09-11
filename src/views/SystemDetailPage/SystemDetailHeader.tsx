import { Box, Typography, IconButton } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Button as CmsButton } from '@cmsgov/design-system'
import { useHref, useNavigate } from 'react-router-dom'
import { questionnairePath } from '@/views/QuestionnairePage/deepLink'

interface SystemDetailHeaderProps {
  systemName: string
  /** Keys the Questionnaire link; the questionnaire route is addressed by
   * fismasystemid, same as this page (ui#609, #732). */
  fismasystemid: number
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
  fismasystemid,
  canEdit,
  isEditing,
  isSaving,
  isFormValid,
  onEdit,
  onSave,
  onCancel,
}: SystemDetailHeaderProps) {
  const navigate = useNavigate()
  // Rendered as an <a> via CmsButton's href so open-in-new-tab and copy-link
  // work. CmsButton has no polymorphic `component` prop, so react-router's Link
  // cannot be composed in; useHref resolves the path the same way Link would
  // (under the app's hash router it yields `#/questionnaire/<id>`) instead of
  // hand-writing the fragment. (#640 review) The id in the URL is the whole
  // address, so no route state is needed and every click shape (plain,
  // modified, copy-link) opens this exact system.
  const questionnaireHref = useHref(questionnairePath(fismasystemid))

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
            {/* Cross-navigation to this system's questionnaire (ui#609). The
                route state carries only the fismasystemid: QuestionnairePage
                falls back to the selected/latest data call when location.state
                has no datacallid, which is the right default arriving from
                here, and the href stays plainly shareable. Rendered only
                outside edit mode so a dirty form keeps Save/Cancel as its only
                actions. A decommissioned system links too and the
                questionnaire's own "no questionnaire is available" alert
                explains the outcome. */}
            <CmsButton href={questionnaireHref}>Questionnaire</CmsButton>
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
