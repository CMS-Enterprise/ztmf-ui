import Typography from '@mui/material/Typography'
import { Container } from '@mui/material'
import { useLoaderData } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import { Outlet, Link } from 'react-router-dom'
import logo from '../../assets/icons/logo.svg'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import 'core-js/stable/atob'
import { userData } from '@/types'
import { Button as CmsButton } from '@cmsgov/design-system'
import { Box } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useState, useEffect } from 'react'
import { FismaSystemType } from '@/types'
import { Routes } from '@/router/constants'
import axiosInstance from '@/axiosConfig'
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [fismaSystems, setFismaSystems] = useState<FismaSystemType[]>([])
  const [titlePage, setTitlePage] = useState<string>('Dashboard')
  useEffect(() => {
    async function fetchFismaSystems() {
      try {
        const fismaSystems = await axiosInstance.get('/fismasystems')
        if (fismaSystems.status !== 200) {
          return
        }
        console.log(fismaSystems.data.data)
        setFismaSystems(fismaSystems.data.data)
      } catch (error) {
        console.log(error)
      }
    }
    if (loaderData.status == 200) {
      fetchFismaSystems()
    }
  }, [loaderData.status])
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleOption = (option: string) => {
    setTitlePage(option)
    setAnchorEl(null)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}
                  >
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
                    {userInfo.role === 'ADMIN' ? (
                      <>
                        <IconButton
                          aria-label="more"
                          aria-controls="long-menu"
                          aria-haspopup="true"
                          onClick={handleClick}
                        >
                          <MoreVertIcon />
                        </IconButton>
                        <Menu
                          id="long-menu"
                          anchorEl={anchorEl}
                          keepMounted
                          open={Boolean(anchorEl)}
                          onClose={handleClose}
                        >
                          <Link
                            to={Routes.ROOT}
                            style={{ textDecoration: 'none', color: 'black' }}
                          >
                            <MenuItem onClick={() => handleOption('Dashboard')}>
                              Dashboard
                            </MenuItem>
                          </Link>
                          <Link
                            to={Routes.USERS}
                            style={{ textDecoration: 'none', color: 'black' }}
                          >
                            <MenuItem onClick={() => handleOption('Users')}>
                              Edit Users
                            </MenuItem>
                          </Link>
                        </Menu>
                      </>
                    ) : (
                      <></>
                    )}
                  </Box>
                </div>
              ) : (
                <div></div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Container>
        <Typography variant="h3" align="center">
          Zero Trust Maturity Score {titlePage}
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
          <Outlet context={{ fismaSystems }} />
        )}
      </Container>
    </>
  )
}
