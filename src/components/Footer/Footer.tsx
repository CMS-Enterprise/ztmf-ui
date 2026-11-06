import logo from '../../assets/icons/logo.svg'
import { Box, Container, Typography } from '@mui/material'
export default function Footer() {
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
          </div>
        </Container>
      </Box>
    </Box>
  )
}
