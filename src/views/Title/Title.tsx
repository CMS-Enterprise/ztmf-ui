import {
  Container,
  Typography,
  Button,
  Checkbox,
  ListSubheader,
  ListItemText,
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { useLoaderData, useLocation } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import { Outlet, Link } from 'react-router-dom'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import 'core-js/stable/atob'
import { userData, UserRole, datacall, DataCenterEnvironment } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead as checkHasAdminRead,
  isUnscopedWriteAdmin,
} from '@/utils/userRoles'
import { Box } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  groupDatacallsByYear,
  parseDatacallName,
} from '@/utils/datacallGrouping'
import { FismaSystemType } from '@/types'
import { Routes } from '@/router/constants'
import type { AuthLoaderData } from '@/router/authLoader'
import EmailModal from '@/components/EmailModal/EmailModal'
import axiosInstance from '@/axiosConfig'
import { notify } from '@/utils/notify'
import { fetchDataCenterEnvironments } from '@/utils/dataCenterEnvironments'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import LoginPage from '../LoginPage/LoginPage'
import ServerErrorPage from '../ServerErrorPage/ServerErrorPage'
import EditSystemModal from '../EditSystemModal/EditSystemModal'
import { EMPTY_SYSTEM } from '../EditSystemModal/emptySystem'
import _ from 'lodash'
import DataCallModal from '../DatacallModal/DataCallModal'
import Footer from '@/components/Footer/Footer'
import DevEnvironmentBanner from '@/components/DevEnvironmentBanner/DevEnvironmentBanner'
import ztmfLogo from '@/assets/ztmf-logo-color.png'
import { clearOtherUserDrafts } from '../QuestionnairePage/draftStore'
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
  // The dashboard aggregates the active year's data calls. activeYear is the
  // selected fiscal year; activeDatacallIds are the toggled-on calls within it
  // (all on by default). See groupDatacallsByYear / #467.
  const [activeYear, setActiveYear] = useState<number | null>(null)
  const [activeDatacallIds, setActiveDatacallIds] = useState<number[]>([])
  const [datacallMenuAnchor, setDatacallMenuAnchor] =
    useState<null | HTMLElement>(null)
  const [latestDeadline, setLatestDeadline] = useState<string>('')
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [openEmailModal, setOpenEmailModal] = useState<boolean>(false)
  const [latestDatacall, setLatestDatacall] = useState<string>('')
  const [showDecommissioned, setShowDecommissioned] = useState<boolean>(false)
  const [datacenterEnvironments, setDatacenterEnvironments] = useState<
    DataCenterEnvironment[]
  >([])

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
    if (loaderData.status === 200) void clearOtherUserDrafts(userInfo.userid)
  }, [loaderData.status, userInfo.userid])

  // Hoisted out of the mount effect so it can be re-invoked on demand -
  // specifically, right after DataCallModal creates a new datacall so the
  // picker updates without a manual page reload. Accepts an optional
  // signal for the mount-effect's abort cleanup; user-triggered refetches
  // (e.g. post-create) invoke it without a signal.
  const fetchDatacalls = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await axiosInstance.get(
        '/datacalls',
        signal ? { signal } : {}
      )
      if (signal?.aborted) return
      // "Latest"/"current" is the call with the furthest-out deadline, not
      // the highest datacallid: historical loads can carry a higher id than
      // the real current call. datacallid is only a tiebreak.
      const sorted: datacall[] = sortDatacallsByDeadline(
        res.data.data as datacall[]
      )
      setDatacalls(sorted)
      if (sorted.length > 0) {
        setLatestDataCallId(sorted[0].datacallid)
        setLatestDatacall(sorted[0].datacall)
        setLatestDeadline(sorted[0].deadline)
        // Default to the latest year with data, all of its calls toggled on.
        const [firstGroup] = groupDatacallsByYear(sorted)
        if (firstGroup) {
          setActiveYear(firstGroup.year)
          setActiveDatacallIds(firstGroup.calls.map((c) => c.datacallid))
        }
      }
    } catch (error) {
      if (signal?.aborted) return
      console.error('Fetch latest datacall error:', error)
    }
  }, [])

  useEffect(() => {
    if (loaderData.status !== 200) return
    const controller = new AbortController()
    fetchDatacalls(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loaderData.status, fetchDatacalls])

  // Datacenter-environment vocabulary is reference data shared by the system
  // form (dropdown) and the questionnaire pillar filter, so it is fetched
  // once here and passed down via context. Failure is non-fatal: consumers
  // fall back to raw values when the list is empty.
  useEffect(() => {
    if (loaderData.status !== 200) return
    const controller = new AbortController()
    fetchDataCenterEnvironments(controller.signal)
      .then(setDatacenterEnvironments)
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Fetch datacenter environments error:', error)
      })
    return () => {
      controller.abort()
    }
  }, [loaderData.status])
  const datacallsByYear = useMemo(
    () => groupDatacallsByYear(datacalls),
    [datacalls]
  )
  // Single active call when exactly one is toggled on, else null. Drives the
  // single-id flows (questionnaire, export, diff); null signals aggregation.
  const selectedDatacall = useMemo<datacall | null>(
    () =>
      activeDatacallIds.length === 1
        ? datacalls.find((d) => d.datacallid === activeDatacallIds[0]) ?? null
        : null,
    [activeDatacallIds, datacalls]
  )
  // Selecting a call in a different year switches to that whole year (all on);
  // within the active year, toggle a call but never leave the year empty.
  const handleDatacallToggle = (
    group: (typeof datacallsByYear)[number],
    call: datacall
  ) => {
    if (group.year !== activeYear) {
      setActiveYear(group.year)
      setActiveDatacallIds(group.calls.map((c) => c.datacallid))
      return
    }
    setActiveDatacallIds((prev) => {
      const removing = prev.includes(call.datacallid)
      if (removing && prev.length === 1) return prev // never empty the year
      const next = new Set(prev)
      if (removing) {
        next.delete(call.datacallid)
      } else {
        next.add(call.datacallid)
      }
      // Keep the group's deadline order (newest first) so the dashboard merge
      // deterministically resolves a multi-call system to its newest call.
      return group.calls.map((c) => c.datacallid).filter((id) => next.has(id))
    })
  }

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
  // Ends the session: calls the backend logout endpoint that clears the
  // ztmf_session and ALB OIDC cookies, then forces a full reload onto the
  // sign-in route. The reload is deliberate - it re-runs the root authLoader
  // against the now-cleared cookie so Title re-renders LoginPage. A client-
  // side hash change alone would not re-run the loader, and a full reload
  // also guarantees no in-memory session state lingers. Logout is best-
  // effort: even if the request fails we still drop the user to sign-in.
  //
  // skipAuthHandling short-circuits the centralized 401 interceptor - if the
  // session has already expired, the interceptor's own /signin redirect is
  // redundant with the reload we do below and only causes a flash of the
  // "Session expired" message before the reload lands.
  //
  // The timeout caps a hung logout so a dead or slow backend cannot leave
  // the user stuck with no visible feedback. The notify toast covers the
  // gap between click and reload on any connection speed.
  const handleLogout = async () => {
    setAnchorEl(null)
    notify('Signing out...', 'info')
    try {
      await axiosInstance.post('/auth/logout', null, {
        skipAuthHandling: true,
        timeout: 5000,
      })
    } catch (error) {
      console.error('Error logging out:', error)
    }
    window.location.hash = Routes.SIGNIN
    window.location.reload()
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
  const datacallContextNeeded =
    isHomeRoute || isQuestionnaireRoute || isSystemDetail
  // Single source of truth for header logo sizing; divider scales with it
  // so the mark, divider, and wordmark stay vertically centered on resize.
  const LOGO_HEIGHT = 55
  // The logo art is vertically asymmetric: the arrow tip extends well above the
  // letter caps, so the PNG's bounding-box center sits above the wordmark's
  // optical center. Shift the divider + text down by ~10% of the logo height so
  // they align to the letters rather than the box. Scales with LOGO_HEIGHT.
  const LOGO_OPTICAL_OFFSET = Math.round(LOGO_HEIGHT * 0.1)
  return (
    <>
      {/* Left-align the USA banner's content with the ZTMF logo below it by
          dropping the CMSDS max-width centering and matching the header's
          responsive horizontal padding. */}
      <Box
        sx={{
          '& .ds-c-usa-banner__header, & .ds-c-usa-banner__guidance': {
            maxWidth: 'none',
            px: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
          },
        }}
      >
        <UsaBanner />
      </Box>
      {/* Match the dev banner's text start to the logo/USA-banner content
          while the coloured bar stays full-bleed. */}
      <Box
        sx={{
          '& .MuiAlert-root': {
            px: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
          },
        }}
      >
        <DevEnvironmentBanner authenticated={loaderData.status === 200} />
      </Box>
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
              style={{ height: LOGO_HEIGHT, width: 'auto', display: 'block' }}
            />
            <Box
              sx={{
                width: '1px',
                height: Math.round(LOGO_HEIGHT * 0.7),
                backgroundColor: 'rgba(0,0,0,0.12)',
                flexShrink: 0,
                transform: `translateY(${LOGO_OPTICAL_OFFSET}px)`,
              }}
            />
            <Box
              sx={{
                lineHeight: 1.15,
                transform: `translateY(${LOGO_OPTICAL_OFFSET}px)`,
              }}
            >
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
                  {idpBadge && (
                    <Typography
                      component="span"
                      sx={{
                        color: 'text.secondary',
                        ml: 0.5,
                        fontSize: '0.85em',
                      }}
                    >
                      ({idpBadge})
                    </Typography>
                  )}
                </span>
              )}
              {/* Account menu is rendered for every logged-in user so the
                  logout affordance is always available. The admin-only items
                  inside remain individually gated; a non-admin sees just
                  Dashboard and Log out. */}
              <>
                <IconButton
                  aria-label="Account menu"
                  aria-controls="account-menu"
                  aria-haspopup="true"
                  onClick={handleClick}
                >
                  <MoreVertIcon />
                </IconButton>
                <Menu
                  id="account-menu"
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
                  {hasAdminRead && (
                    <Link
                      to={Routes.USERS}
                      style={{ textDecoration: 'none', color: 'black' }}
                    >
                      <MenuItem onClick={() => handleOption()}>Users</MenuItem>
                    </Link>
                  )}
                  {userInfo.role === 'OWNER' && (
                    <Link
                      to={Routes.ADMIN_OPDIVS}
                      style={{ textDecoration: 'none', color: 'black' }}
                    >
                      <MenuItem onClick={() => handleOption()}>
                        Manage OpDivs
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
                  {isUnscopedWriteAdmin(userInfo) && (
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
                  <MenuItem onClick={handleLogout}>Log out</MenuItem>
                </Menu>
              </>
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
            px: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
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
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => setDatacallMenuAnchor(e.currentTarget)}
                    endIcon={<ArrowDropDownIcon />}
                    sx={{
                      minWidth: 260,
                      justifyContent: 'space-between',
                      textTransform: 'none',
                      color: 'text.primary',
                      borderColor: 'rgba(0,0,0,0.23)',
                    }}
                  >
                    {activeYear ??
                      (activeDatacallIds.length ? 'Other' : 'Data call')}
                    {selectedDatacall
                      ? ` · ${selectedDatacall.datacall}`
                      : activeDatacallIds.length > 1
                        ? ` · ${activeDatacallIds.length} calls`
                        : ''}
                  </Button>
                  <Menu
                    anchorEl={datacallMenuAnchor}
                    open={Boolean(datacallMenuAnchor)}
                    onClose={() => setDatacallMenuAnchor(null)}
                    MenuListProps={{ 'aria-label': 'Select data call by year' }}
                  >
                    {datacallsByYear.flatMap((group) => [
                      <ListSubheader key={`year-${group.year ?? 'other'}`}>
                        {group.year ?? 'Other'}
                      </ListSubheader>,
                      ...group.calls.map((call) => {
                        const checked =
                          group.year === activeYear &&
                          activeDatacallIds.includes(call.datacallid)
                        const { tenant } = parseDatacallName(call.datacall)
                        const isClosed = new Date() > new Date(call.deadline)
                        const deadlineLabel = new Date(
                          call.deadline
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                        return (
                          <MenuItem
                            key={call.datacallid}
                            dense
                            onClick={() => handleDatacallToggle(group, call)}
                          >
                            <Checkbox
                              checked={checked}
                              readOnly
                              size="small"
                              sx={{ mr: 1 }}
                            />
                            <ListItemText
                              primary={`${call.datacall} · ${tenant}`}
                              secondary={`${
                                isClosed ? 'Closed' : 'Active'
                              } · deadline ${deadlineLabel}`}
                            />
                          </MenuItem>
                        )
                      }),
                    ])}
                  </Menu>
                </>
              )
            )}
          </Box>
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
                  latestDeadline,
                  datacalls,
                  activeDatacallIds,
                  selectedDatacall,
                  showDecommissioned,
                  setShowDecommissioned,
                  fetchFismaSystems,
                  datacenterEnvironments,
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
          datacenterEnvironments={datacenterEnvironments}
        />
        <EmailModal
          openModal={openEmailModal}
          closeModal={handleCloseEmailModal}
        />
        <DataCallModal
          open={openDataCallModal}
          onClose={handleDataCallClose}
          onCreated={fetchDatacalls}
        />
      </Container>
      <Footer />
    </>
  )
}
