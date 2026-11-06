import logo from '../../assets/icons/logo.svg'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, Link, Typography } from '@mui/material'
import { Routes } from '@/router/constants'
import { colors } from '@/theme/tokens'

type FooterProps = {
  /** Whether a session is active; the Help link renders only when it is. */
  authenticated?: boolean
}

export default function Footer({ authenticated = false }: FooterProps) {
  return (
    <Box
      sx={{
        borderTop: '1px solid #000',
      }}
      component="footer"
    >
      <Box
        sx={{
          backgroundColor: '#f2f2f2',
        }}
      >
        <Container>
          <div className="ds-u-display--flex ds-u-flex-direction--row">
            <div>
              <img
                className="ds-u-margin-top--2"
                src={logo}
                alt="CMS.gov"
                width={175}
                height={75}
              />
            </div>
            <div className="ds-u-padding--1 ds-u-margin--1 ds-u-margin-top--2 ds-u-border-left--2">
              <Typography variant="body1" sx={{ mt: 2 }}>
                Centers for Medicare &amp; Medicaid Services
              </Typography>
            </div>
            {authenticated && (
              <Box sx={{ ml: 'auto', mt: 4 }}>
                {/* Explicit token color: MUI's default link blue falls short
                    of 4.5:1 contrast on the footer's gray. */}
                <Link
                  component={RouterLink}
                  to={Routes.HELP}
                  sx={{ color: colors.primary }}
                >
                  Help &amp; support
                </Link>
              </Box>
            )}
          </div>
        </Container>
      </Box>
    </Box>
  )
}
