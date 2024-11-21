import { Box, Typography } from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { useLocation } from 'react-router-dom'

export default function LoginPage() {
  const location = useLocation()
  const message = location.state?.message || ''
  return (
    <Box
      flex={1}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography variant="h4" sx={{ mb: 2 }}>
          {message}
        </Typography>
        <CmsButton href="/login">Login</CmsButton>
      </Box>
    </Box>
  )
}
