import {
  Container,
  Typography,
  Autocomplete,
  TextField,
  Chip,
} from '@mui/material'
import { useLoaderData, useLocation } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import { Outlet, Link } from 'react-router-dom'
import 'core-js/stable/atob'
import { userData, UserRole, datacall } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead as checkHasAdminRead,
  isUnscopedWriteAdmin,
} from '@/utils/userRoles'
import { Box, Tooltip } from '@mui/material'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useState, useEffect, useCallback } from 'react'
import { FismaSystemType } from '@/types'
import { Routes } from '@/router/constants'
import type { AuthLoaderData } from '@/router/authLoader'
import EmailModal from '@/components/EmailModal/EmailModal'
import axiosInstance from '@/axiosConfig'
import LoginPage from '../LoginPage/LoginPage'
import ServerErrorPage from '../ServerErrorPage/ServerErrorPage'
import EditSystemModal from '../EditSystemModal/EditSystemModal'
import { EMPTY_SYSTEM } from '../EditSystemModal/emptySystem'
import _ from 'lodash'
import DataCallModal from '../DatacallModal/DataCallModal'
import Footer from '@/components/Footer/Footer'
import ztmfLogo from '@/assets/ztmf-logo-color.png'
import { colors } from '@/theme/tokens'
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

export default function Title() {
  const location = useLocation()
  const loaderData = useLoaderData() as AuthLoaderData
  const [openDataCallModal, setOpenDataCallModal] = useState<boolean>(false)
  const userInfo: userData =
    loaderData.status != 200 ? emptyUser : loaderData.response
  // Determine wether we are on the sign-in page or not
  const normalizedPath = location.pathname.toLowerCase().replace(/\/$/, '')
  const isSignInRoute = normalizedPath === Routes.SIGNIN.toLowerCase()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [fismaSystems, setFismaSystems] = useState<FismaSystemType[]>([])
  const [datacalls, setDatacalls] = useState<datacall[]>([])
  const [latestDataCallId, setLatestDataCallId] = useState<number>(0)
  const [selectedDatacall, setSelectedDatacall] = useState<datacall | null>(
    null
  )
  const [latestDeadline, setLatestDeadline] = useState<string>('')
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [openEmailModal, setOpenEmailModal] = useState<boolean>(false)
  const [latestDatacall, setLatestDatacall] = useState<string>('')
  const [showDecommissioned, setShowDecommissioned] = useState<boolean>(false)
  const [dashboardSearch, setDashboardSearch] = useState<string>('')

  const fetchFismaSystems = useCallback(
    async (decommissioned: boolean = false) => {
      const url = decommissioned
        ? '/fismasystems?decommissioned=true'
        : '/fismasystems'
      try {
        const res = await axiosInstance.get(url)
        setFismaSystems(res.data.data)
      } catch (error) {
        console.error(
          'Fetch systems error:',
          (error as { response?: { status?: number; data?: unknown } }).response
            ?.status,
          (error as { response?: { status?: number; data?: unknown } }).response
            ?.data
        )
      }
    },
    []
  )

  // Both of the effects below gate on loaderData.status === 200 (an active
  // app session) rather than only on serverError. When the user is not
  // logged in or has no app account, the loader returns { ok: false } with
  // no status field, and these calls would 401. Those 401s do not use
  // skipAuthHandling, so the centralized interceptor catches them and
  // redirects to /signin with the "session expired" message - misleading
  // for the never-logged-in case and noisy on every cold load.
  useEffect(() => {
    if (loaderData.status === 200) fetchFismaSystems(showDecommissioned)
  }, [showDecommissioned, fetchFismaSystems, loaderData.status])

  useEffect(() => {
    if (loaderData.status !== 200) return
    const controller = new AbortController()
    async function fetchDatacalls() {
      try {
        const res = await axiosInstance.get('/datacalls', {
          signal: controller.signal,
        })
        const sorted: datacall[] = [...res.data.data].sort(
          (a: datacall, b: datacall) => b.datacallid - a.datacallid
        )
        setDatacalls(sorted)
        if (sorted.length > 0) {
          setLatestDataCallId(sorted[0].datacallid)
          setLatestDatacall(sorted[0].datacall)
          setLatestDeadline(sorted[0].deadline)
          setSelectedDatacall(sorted[0])
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Fetch latest datacall error:', error)
      }
    }
    fetchDatacalls()
    return () => {
      controller.abort()
    }
  }, [loaderData.status])
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }
  // Display name for the IdP that minted the user's session. Surfaced
  // as a small badge next to the name so support can debug "I logged
  // in but the dashboard looks wrong" without DevTools.
  const idpBadge =
    userInfo.identity_provider === 'entra'
      ? 'Entra'
      : userInfo.identity_provider === 'okta'
        ? 'Okta'
        : ''
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
  const isSystemDetail = location.pathname.startsWith('/systems/')
  const isHomeRoute = location.pathname === '/'
  const isQuestionnaireRoute = location.pathname.startsWith('/questionnaire/')
  // The dashboard renders its own datacall card in-body (matching the mock),
  // so the slim sub-bar only shows on the questionnaire and system-detail
  // routes that still need the datacall context inline.
  const datacallContextNeeded = isQuestionnaireRoute || isSystemDetail
  // Initials for the account avatar, from the user's name (or email).
  const initials =
    (userInfo.fullname || userInfo.email || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  // Primary navigation, lifted out of the kebab into a visible header row.
  // Each item keeps the same role gating the old menu used. The kebab now
  // holds only genuine actions (create/email), never navigation.
  const navItems = [
    { label: 'Dashboard', to: Routes.ROOT, active: isHomeRoute, show: true },
    {
      label: 'Users',
      to: Routes.USERS,
      active: location.pathname.startsWith('/users'),
      show: hasAdminRead,
    },
    {
      label: 'OpDivs',
      to: Routes.ADMIN_OPDIVS,
      active: location.pathname.startsWith('/admin/opdivs'),
      show: userInfo.role === 'OWNER',
    },
  ].filter((item) => item.show)
  // The Admin dropdown only appears when the user actually has an action to
  // take. Read-only admins have nav but no create/email actions.
  const hasHeaderActions = isAdmin || isUnscopedWriteAdmin(userInfo)
  return (
    <>
      <UsaBanner />
      {/* Branded header bar. Hidden on the /signin route AND any time
          LoginPage is rendered as the body (loaderData.status !== 200),
          so the header never sits above a "please sign in" prompt at any
          URL, not just /signin. Matches the datacall sub-bar's gate. */}
      {!isSignInRoute && loaderData.status === 200 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, sm: 4 },
            py: 1.5,
            borderBottom: '1px solid rgba(0,0,0,0.12)',
            minWidth: 800,
          }}
        >
          {/* left: ZTMF mark + primary nav */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Link
              to={Routes.ROOT}
              style={{ display: 'flex', textDecoration: 'none' }}
            >
              <img
                src={ztmfLogo}
                alt="ZTMF"
                style={{ height: 30, width: 'auto', display: 'block' }}
              />
            </Link>

            {/* primary nav tabs */}
            <Box
              component="nav"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  style={{ textDecoration: 'none' }}
                >
                  <Box
                    sx={{
                      px: 3.5,
                      py: 2,
                      borderRadius: 1.5,
                      fontSize: 13,
                      fontWeight: 600,
                      color: item.active ? colors.primary : colors.neutral700,
                      backgroundColor: item.active
                        ? colors.primary50
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: item.active
                          ? colors.primary50
                          : colors.neutral50,
                      },
                    }}
                  >
                    {item.label}
                  </Box>
                </Link>
              ))}
            </Box>
          </Box>

          {/* right: account avatar. For admins it opens the actions menu. */}
          {loaderData.status == 200 && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip
                title={
                  userInfo.fullname
                    ? `${userInfo.fullname}${idpBadge ? ` (${idpBadge})` : ''}`
                    : 'Account'
                }
              >
                <Box
                  role={hasHeaderActions ? 'button' : undefined}
                  aria-controls={hasHeaderActions ? 'actions-menu' : undefined}
                  aria-haspopup={hasHeaderActions ? 'true' : undefined}
                  aria-label={`Account: ${userInfo.fullname || 'user'}`}
                  onClick={hasHeaderActions ? handleClick : undefined}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    p: 0.5,
                    pr: hasHeaderActions ? 1 : 0.5,
                    borderRadius: 999,
                    cursor: hasHeaderActions ? 'pointer' : 'default',
                    ...(hasHeaderActions && {
                      border: `1px solid ${colors.neutral200}`,
                      '&:hover': { backgroundColor: colors.neutral50 },
                    }),
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: colors.ink900,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </Box>
                  {hasHeaderActions && (
                    <MoreHorizIcon
                      sx={{ fontSize: 18, color: colors.neutral500 }}
                    />
                  )}
                </Box>
              </Tooltip>
              {hasHeaderActions && (
                <Menu
                  id="actions-menu"
                  anchorEl={anchorEl}
                  keepMounted
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  {isAdmin && (
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null)
                        setOpenModal(true)
                      }}
                    >
                      Add FISMA system
                    </MenuItem>
                  )}
                  {isUnscopedWriteAdmin(userInfo) && (
                    <MenuItem
                      onClick={() => {
                        setAnchorEl(null)
                        setOpenEmailModal(true)
                      }}
                    >
                      Email users
                    </MenuItem>
                  )}
                  {isAdmin && (
                    <MenuItem
                      onClick={() => {
                        handleClose()
                        setOpenDataCallModal(true)
                      }}
                    >
                      Create datacall
                    </MenuItem>
                  )}
                </Menu>
              )}
            </Box>
          )}
        </Box>
      )}
      {/* Datacall sub-bar (shown when datacall context needed, hidden everywhere else) */}
      {loaderData.status == 200 && datacallContextNeeded && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, sm: 4 },
            py: 1,
            backgroundColor: '#fbfbfd',
            borderBottom: '1px solid rgba(0,0,0,0.12)',
            minWidth: 800,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="subtitle1"
              component="span"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Datacall:
            </Typography>
            {isSystemDetail ? (
              <Typography variant="subtitle1" component="span">
                {latestDatacall}
              </Typography>
            ) : (
              datacalls.length > 0 && (
                <Autocomplete
                  size="small"
                  options={datacalls}
                  getOptionLabel={(dc) => dc.datacall}
                  isOptionEqualToValue={(option, value) =>
                    option.datacallid === value.datacallid
                  }
                  value={selectedDatacall ?? datacalls[0]}
                  onChange={(_, dc) => {
                    if (dc) setSelectedDatacall(dc)
                  }}
                  renderOption={(props, option) => {
                    const isCurrent = option.datacallid === latestDataCallId
                    const isClosed = new Date() > new Date(option.deadline)
                    const { key, ...rest } = props
                    const deadlineLabel = new Date(
                      option.deadline
                    ).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                    return (
                      <li key={key} {...rest}>
                        <Box sx={{ width: '100%' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2">
                              {option.datacall}
                            </Typography>
                            {isCurrent && (
                              <Chip
                                label="Current"
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                          >
                            {isClosed ? 'Closed' : 'Active'} · deadline{' '}
                            {deadlineLabel}
                          </Typography>
                        </Box>
                      </li>
                    )
                  }}
                  disableClearable
                  sx={{ minWidth: 260 }}
                  renderInput={(params) => (
                    <TextField {...params} size="small" />
                  )}
                />
              )
            )}
          </Box>
        </Box>
      )}
      {loaderData.serverError ? (
        <Container
          maxWidth={false}
          sx={{ px: { xs: 2, sm: 4 }, minWidth: 800 }}
        >
          <ServerErrorPage />
        </Container>
      ) : loaderData.status !== 200 ? (
        <Container
          maxWidth={false}
          sx={{ px: { xs: 2, sm: 4 }, minWidth: 800 }}
        >
          <LoginPage />
        </Container>
      ) : (
        // Full-bleed gray canvas: the background spans the viewport while the
        // page content stays padded to the same gutters as the header.
        <Box
          component="main"
          sx={{
            backgroundColor: colors.neutral50,
            minWidth: 800,
            px: { xs: 2, sm: 4 },
          }}
        >
          <Outlet
            context={{
              fismaSystems,
              setFismaSystems,
              userInfo,
              latestDataCallId,
              latestDatacall,
              latestDeadline,
              datacalls,
              selectedDatacall,
              setSelectedDatacall,
              showDecommissioned,
              setShowDecommissioned,
              fetchFismaSystems,
              dashboardSearch,
              setDashboardSearch,
            }}
          />
        </Box>
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
      <Footer />
    </>
  )
}
