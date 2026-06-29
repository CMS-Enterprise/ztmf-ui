import { ReactNode } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import IconActionButton from './IconActionButton'
import { colors } from '@/theme/tokens'

/** Props for {@link SideDrawer}. */
export type SideDrawerProps = {
  /** Whether the drawer is open. */
  open: boolean
  /** Called when the user dismisses the drawer. */
  onClose: () => void
  /** Heading shown in the drawer header. */
  title: ReactNode
  /** Optional small uppercase line above the title (for example a user name). */
  eyebrow?: ReactNode
  /** Body content. */
  children: ReactNode
  /** Footer content, typically a Cancel plus a primary action. */
  footer?: ReactNode
  /** Drawer width in pixels. Defaults to 480. */
  width?: number
}

/**
 * Right-anchored drawer that mirrors the Modal contract (header with an X
 * close top-right, scrollable body, footer with right-aligned actions).
 *
 * Used for assignment-style tasks that need room to breathe and a persistent
 * list, where a centered modal left a wasteland of empty space.
 * @param {SideDrawerProps} props - Open state, handlers, header, body, footer.
 * @returns {JSX.Element} A right-side drawer.
 */
export function SideDrawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 480,
}: SideDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: '100vw', sm: width },
          maxWidth: '100vw',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            px: 5,
            pt: 4.5,
            pb: 3.5,
            borderBottom: `1px solid ${colors.neutral200}`,
          }}
        >
          <Box>
            {eyebrow && (
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: colors.neutral500,
                  mb: 0.5,
                }}
              >
                {eyebrow}
              </Typography>
            )}
            <Typography
              sx={{ fontSize: 17, fontWeight: 700, color: colors.ink }}
            >
              {title}
            </Typography>
          </Box>
          <IconActionButton
            label="Close"
            onClick={onClose}
            sx={{ mt: -0.5, mr: -1 }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconActionButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', px: 5, py: 4 }}>{children}</Box>

        {footer && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 2,
              px: 5,
              py: 3.5,
              backgroundColor: colors.neutral50,
              borderTop: `1px solid ${colors.neutral200}`,
            }}
          >
            {footer}
          </Box>
        )}
      </Box>
    </Drawer>
  )
}

export default SideDrawer
