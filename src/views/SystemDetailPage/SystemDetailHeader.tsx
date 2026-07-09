import { Box, Typography, IconButton } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Button as CmsButton } from '@cmsgov/design-system'
import { useNavigate } from 'react-router-dom'

interface SystemDetailHeaderProps {
  systemName: string
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
          canEdit && (
            <CmsButton variation="solid" onClick={onEdit}>
              Edit
            </CmsButton>
          )
        )}
      </Box>
    </Box>
  )
}
