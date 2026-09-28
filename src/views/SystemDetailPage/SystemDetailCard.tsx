import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, radius } from '@/theme/tokens'

interface SystemDetailCardProps {
  title: string
  subheader?: string
  action?: ReactNode
  children: ReactNode
}

/**
 * Shared visual shell for cards in the System Detail read view.
 */
export default function SystemDetailCard({
  title,
  subheader,
  action,
  children,
}: SystemDetailCardProps) {
  return (
    <Box
      sx={{
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.25,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: subheader ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: subheader ? 0.5 : 1.5,
        }}
      >
        <Typography
          component="h2"
          sx={{ fontSize: 14, fontWeight: 700, color: colors.ink }}
        >
          {title}
        </Typography>
        {action}
      </Box>
      {subheader && (
        <Typography sx={{ fontSize: 13, color: colors.neutral500, mb: 1.5 }}>
          {subheader}
        </Typography>
      )}
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Box>
  )
}
