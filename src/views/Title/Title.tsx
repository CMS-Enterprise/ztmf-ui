import { Container, Typography } from '@mui/material'
import { useLoaderData, useNavigate } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import { Outlet, Link } from 'react-router-dom'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import 'core-js/stable/atob'
import { userData, UserRole } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead as checkHasAdminRead,
} from '@/utils/userRoles'
import { Box } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useState, useEffect, useCallback } from 'react'
import { FismaSystemType } from '@/types'
import { Routes } from '@/router/constants'
import EmailModal from '@/components/EmailModal/EmailModal'
import axiosInstance from '@/axiosConfig'
import LoginPage from '../LoginPage/LoginPage'
import ServerErrorPage from '../ServerErrorPage/ServerErrorPage'
import { ERROR_MESSAGES } from '@/constants'
import EditSystemModal from '../EditSystemModal/EditSystemModal'
import { EMPTY_SYSTEM } from '../EditSystemModal/emptySystem'
import _ from 'lodash'
import DataCallModal from '../DatacallModal/DataCallModal'
import Footer from '@/components/Footer/Footer'
import ztmfLogo from '@/assets/ztmf-logo-clean.svg'
/**
 * Component that renders the contents of the Dashboard view.
 * @returns {JSX.Element} Component that renders the dashboard contents.
 */

const emptyUser: userData = {
  userid: '',
  email: '',
  fullname: '',
  role: '' as UserRole,
  assignedfismasystems: [],
}

type PromiseType = {
  status: boolean | number
  response: userData
  serverError?: boolean
}
export default function Title() {
  const navigate = useNavigate()
  const loaderData = useLoaderData() as PromiseType
  const [openDataCallModal, setOpenDataCallModal] = useState<boolean>(false)
  const userInfo: userData =
    loaderData.status != 200 ? emptyUser : loaderData.response
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [fismaSystems, setFismaSystems] = useState<FismaSystemType[]>([])
  const [latestDataCallId, setLatestDataCallId] = useState<number>(0)
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [openEmailModal, setOpenEmailModal] = useState<boolean>(false)
  const [latestDatacall, setLatestDatacall] = useState<string>('')
  const [showDecommissioned, setShowDecommissioned] = useState<boolean>(false)

  const fetchFismaSystems = useCallback(
    async (decommissioned: boolean = false) => {
      const url = decommissioned
        ? '/fismasystems?decommissioned=true'
        : '/fismasystems'
      await axiosInstance
        .get(url)
        .then((res) => {
          setFismaSystems(res.data.data)
        })
        .catch((error) => {
          console.error(
            'Fetch systems error:',
            error.response?.status,
            error.response?.data
          )
          if (error.response?.status === 401) {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.login,
              },
            })
          }
        })
    },
    [navigate]
  )

  useEffect(() => {
    if (!loaderData.serverError) fetchFismaSystems(showDecommissioned)
  }, [showDecommissioned, fetchFismaSystems, loaderData.serverError])

  useEffect(() => {
    if (loaderData.serverError) return
    async function fetchLatestDatacall() {
      await axiosInstance
        .get('/datacalls/latest')
        .then((res) => {
          setLatestDataCallId(res.data.data.datacallid)
          setLatestDatacall(res.data.data.datacall)
        })
        .catch((error) => {
          if (error.response?.status == 401) {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.expired,
              },
            })
          }
        })
    }
    fetchLatestDatacall()
  }, [navigate, loaderData.serverError])
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleOption = () => {
    // setTitlePage(option)
    setAnchorEl(null)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }
  const handleCloseModal = (newRowData: FismaSystemType) => {
    if (!_.isEqual(EMPTY_SYSTEM, newRowData)) {
      setFismaSystems((prevFismSystems) => [...prevFismSystems, newRowData])
    }
    setOpenModal(false)
    handleClose()
  }
  const handleCloseEmailModal = () => {
    setOpenEmailModal(false)
  }
  const handleDataCallClose = () => {
    setOpenDataCallModal(false)
  }
  const isAdmin = checkIsAdmin(userInfo)
  const hasAdminRead = checkHasAdminRead(userInfo)
  return (
    <>
      <UsaBanner />
      {/* Branded header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
          py: 1.5,
          borderBottom: '1px solid rgba(0,0,0,0.12)',
          minWidth: 800,
        }}
      >
        {/* left: ZTMF mark + wordmark */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <img
            src={ztmfLogo}
            alt="ZTMF"
            style={{ height: 42, width: 'auto', display: 'block' }}
          />
          <Box
            sx={{
              width: '1px',
              height: 38,
              backgroundColor: 'rgba(0,0,0,0.12)',
              flexShrink: 0,
            }}
          />
          <Box sx={{ lineHeight: 1.15 }}>
            <Typography
              sx={{
                fontSize: 17,
                fontWeight: 700,
                color: '#102B52',
                letterSpacing: '0.2px',
                lineHeight: 1.15,
              }}
            >
              Zero Trust Maturity Framework
            </Typography>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7997AF',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                lineHeight: 1.15,
              }}
            >
              Scoring Tool
            </Typography>
          </Box>
        </Box>

        {/* right: account chip (shown when logged in) */}
        {loaderData.status == 200 && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AccountCircleIcon fontSize={'large'} />
            {userInfo.fullname && (
              <span
                style={{ verticalAlign: '13px' }}
                className="ds-text-body--md"
              >
                {userInfo.fullname}
              </span>
            )}
            {hasAdminRead && (
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
                    <MenuItem onClick={() => handleOption()}>
                      Dashboard
                    </MenuItem>
                  </Link>
                  {isAdmin && (
                    <Link
                      to={Routes.USERS}
                      style={{ textDecoration: 'none', color: 'black' }}
                    >
                      <MenuItem onClick={() => handleOption()}>
                        Edit Users
                      </MenuItem>
                    </Link>
                  )}
                  {isAdmin && (
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null)
                        setOpenModal(true)
                      }}
                    >
                      Add Fisma System
                    </MenuItem>
                  )}
                  {isAdmin && (
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null)
                        setOpenEmailModal(true)
                      }}
                    >
                      {'Email Users'}
                    </MenuItem>
                  )}
                  {isAdmin && (
                    <MenuItem
                      onClick={() => {
                        handleClose()
                        setOpenDataCallModal(true)
                      }}
                    >
                      Create Datacall
                    </MenuItem>
                  )}
                </Menu>
              </>
            )}
          </Box>
        )}
      </Box>
      {/* Datacall sub-bar (shown when logged in) */}
      {loaderData.status == 200 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
            py: 1,
            backgroundColor: '#fbfbfd',
            borderBottom: '1px solid rgba(0,0,0,0.12)',
            minWidth: 800,
          }}
        >
          <Typography variant="subtitle1">
            <span className="ds-u-font-weight--semibold">Datacall:</span>{' '}
            {latestDatacall}
          </Typography>
        </Box>
      )}
      <Container
        maxWidth={false}
        sx={{
          px: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
          minWidth: 800,
        }}
      >
        {loaderData.serverError ? (
          <ServerErrorPage />
        ) : loaderData.status !== 200 ? (
          <LoginPage />
        ) : (
          <>
            <Box component="main">
              <Outlet
                context={{
                  fismaSystems,
                  setFismaSystems,
                  userInfo,
                  latestDataCallId,
                  latestDatacall,
                  showDecommissioned,
                  setShowDecommissioned,
                  fetchFismaSystems,
                }}
              />
            </Box>
          </>
        )}

        <EditSystemModal
          title={'Add'}
          open={openModal}
          onClose={handleCloseModal}
          system={EMPTY_SYSTEM}
          mode={'create'}
        />
        <EmailModal
          openModal={openEmailModal}
          closeModal={handleCloseEmailModal}
        />
        <DataCallModal open={openDataCallModal} onClose={handleDataCallClose} />
      </Container>
      <Footer />
    </>
  )
}
