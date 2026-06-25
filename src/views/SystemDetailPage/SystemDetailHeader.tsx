import { Box, Typography, IconButton, Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate } from 'react-router-dom'

interface SystemDetailHeaderProps {
  systemName: string
  isAdmin: boolean
  isEditing: boolean
  isSaving: boolean
  isFormValid: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function SystemDetailHeader({
  systemName,
  isAdmin,
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
        <Typography
          sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          {systemName}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {isEditing ? (
          <>
            <Button
              variant="outlined"
              color="primary"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={onSave}
              disabled={!isFormValid || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        ) : (
          isAdmin && (
            <Button variant="contained" color="primary" onClick={onEdit}>
              Edit system
            </Button>
          )
        )}
      </Box>
    </Box>
  )
}
