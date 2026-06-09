import { Box, Typography } from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { useLocation } from 'react-router-dom'
import ztmfLogo from '@/assets/ztmf-logo-login.png'

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
        minHeight: '54vh',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
          maxWidth: 520,
          textAlign: 'center',
        }}
      >
        {/* ZTMF logo - large, branded hero moment */}
        <img
          src={ztmfLogo}
          alt="ZTMF - Zero Trust Maturity Framework Scoring Tool"
          style={{ width: 540, height: 'auto' }}
        />

        {/* error / session message */}
        {message && (
          <Typography
            variant="body2"
            sx={{ color: 'error.main', fontWeight: 600 }}
          >
            {message}
          </Typography>
        )}

        {/* login button */}
        <CmsButton href="/login" size="big">
          Sign in
        </CmsButton>
      </Box>
    </Box>
  )
}
