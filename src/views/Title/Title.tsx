import { Container, Typography } from '@mui/material'
import { useLoaderData, useNavigate } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import { Outlet, Link } from 'react-router-dom'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import 'core-js/stable/atob'
import { userData } from '@/types'
import { Box } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useState, useEffect } from 'react'
import { FismaSystemType } from '@/types'
import { Routes } from '@/router/constants'
import EmailModal from '@/components/EmailModal/EmailModal'
import axiosInstance from '@/axiosConfig'
import LoginPage from '../LoginPage/LoginPage'
import { ERROR_MESSAGES } from '@/constants'
import EditSystemModal from '../EditSystemModal/EditSystemModal'
import { EMPTY_SYSTEM } from '../EditSystemModal/emptySystem'
import _ from 'lodash'
import DataCallModal from '../DatacallModal/DataCallModal'
import Footer from '@/components/Footer/Footer'
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
  // let latestDataCallId: number = 0
  useEffect(() => {
    async function fetchFismaSystems() {
      await axiosInstance
        .get('/fismasystems')
        .then((res) => {
          setFismaSystems(res.data.data)
        })
        .catch((error) => {
          if (error.response.status === 401) {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.login,
              },
            })
          }
        })
    }
    async function fetchLatestDatacall() {
      await axiosInstance
        .get('/datacalls/latest')
        .then((res) => {
          setLatestDataCallId(res.data.data.datacallid)
          setLatestDatacall(res.data.data.datacall)
        })
        .catch((error) => {
          if (error.response.status == 401) {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.expired,
              },
            })
          }
        })
    }
    const fetchData = async () => {
      await fetchFismaSystems()
      await fetchLatestDatacall()
    }
    fetchData()
  }, [navigate])
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
  return (
    <>
      <UsaBanner />
      <Container>
        {loaderData.status == 200 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              <span className="ds-u-font-weight--semibold">Datacall:</span>{' '}
              {latestDatacall}
            </Typography>
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
                      <MenuItem onClick={() => handleOption()}>
                        Dashboard
                      </MenuItem>
                    </Link>
                    <Link
                      to={Routes.USERS}
                      style={{ textDecoration: 'none', color: 'black' }}
                    >
                      <MenuItem onClick={() => handleOption()}>
                        Edit Users
                      </MenuItem>
                    </Link>
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null)
                        setOpenModal(true)
                      }}
                    >
                      Add Fisma System
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null)
                        setOpenEmailModal(true)
                      }}
                    >
                      {'Email Users'}
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleClose()
                        setOpenDataCallModal(true)
                      }}
                    >
                      Create Datacall
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <></>
              )}
            </Box>
          </Box>
        ) : (
          <div></div>
        )}
      </Container>
      <Container>
        {loaderData.status !== 200 ? (
          <LoginPage />
        ) : (
          <>
            <Box>
              <Outlet
                context={{
                  fismaSystems,
                  userInfo,
                  latestDataCallId,
                  latestDatacall,
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
