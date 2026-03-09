import { Box, Typography } from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'

export default function ServerErrorPage() {
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
          textAlign: 'center',
          maxWidth: 600,
        }}
      >
        <Typography variant="h4" sx={{ mb: 2, color: '#0d2499' }}>
          We&apos;re experiencing technical difficulties
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          The Zero Trust Maturity Framework application is temporarily
          unavailable. Our team has been notified and is working to restore
          service.
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Please try again in a few minutes.
        </Typography>
        <CmsButton onClick={() => window.location.reload()}>
          Try Again
        </CmsButton>
      </Box>
    </Box>
  )
}
