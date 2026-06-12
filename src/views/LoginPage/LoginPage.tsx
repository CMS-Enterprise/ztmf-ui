import { Box, Typography } from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { Navigate, useLocation, useRouteLoaderData } from 'react-router-dom'
import { RouteIds, Routes } from '@/router/constants'
import ztmfLogo from '@/assets/ztmf-logo-login.png'

export default function LoginPage() {
  const location = useLocation()

  // Read the root route's authLoader payload and edirect to the dashboard
  // so /signin never appears as a dead-end "log in again" prompt for an
  // already-authenticated user.
  const rootLoaderData = useRouteLoaderData(RouteIds.ROOT) as
    | { status?: number }
    | undefined

  if (rootLoaderData?.status === 200) {
    return <Navigate to={Routes.ROOT} replace />
  }

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
