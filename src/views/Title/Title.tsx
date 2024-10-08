import Typography from '@mui/material/Typography'
import { Container } from '@mui/material'
import { Outlet, useLoaderData } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import logo from '../../assets/icons/logo.svg'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import 'core-js/stable/atob'
import { userData } from '@/types'
import { Button as CmsButton } from '@cmsgov/design-system'
import { Box } from '@mui/material'
/**
 * Component that renders the contents of the Dashboard view.
 * @returns {JSX.Element} Component that renders the dashboard contents.
 */
const emptyUser: userData = {
  userid: '',
  email: '',
  fullname: '',
  role: '',
  assignedfismasystems: [],
}

type PromiseType = {
  status: boolean | number
  response: userData
}
export default function Title() {
  const loaderData = useLoaderData() as PromiseType
  const userInfo: userData =
    loaderData.status != 200 ? emptyUser : loaderData.response
  return (
    <>
      <UsaBanner />
      <div className="ds-l-row ds-u-margin--0 ds-u-padding-x--2 ds-u-padding-y--0 ds-u-padding-left--6">
        <div className="header-top-wrapper ds-l-md-col--12">
          <div className="region region-cms-header-primary">
            <div className="ds-l-row">
              <div className="ds-l-col--1"></div>
              <div className="ds-l-col--2 ds-u-margin-left--7 ds-u-lg-display--block">
                <img
                  className="ds-u-float--right"
                  src={logo}
                  alt="CMS.gov"
                  width={200}
                  height={100}
                ></img>
              </div>
              <div className="ds-l-col--3 ds-u-lg-display--block ds-u-display--none ds-u-padding-left--0 ds-u-margin-top--5 ds-u-font-weight--semibold">
                Centers for Medicare &amp; Medicaid Services
              </div>
              {loaderData.status == 200 ? (
                <div className="ds-l-col--4 ds-u-lg-display--block ds-u-display--none ds-u-padding-left--0 ds-u-margin-top--5 ds-u-font-weight--semibold">
                  <div className="ds-u-float--right">
                    <AccountCircleIcon fontSize={'large'} />
                    {userInfo.fullname ? (
                      <span
                        style={{ verticalAlign: '13px' }}
                        className="ds-text-body--md"
                      >
                        {userInfo.fullname}
                      </span>
                    ) : (
                      ''
                    )}
                  </div>
                </div>
              ) : (
                <div></div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* </div> */}
      <Container>
        <Typography variant="h3" align="center">
          Zero Trust Maturity Score Dashboard
        </Typography>
        {loaderData.status !== 200 ? (
          <Box
            flex={1}
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '50vh',
            }}
          >
            <CmsButton href="/login">Login</CmsButton>
          </Box>
        ) : (
          <Outlet />
        )}
      </Container>
    </>
  )
}
