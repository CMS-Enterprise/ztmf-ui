import { Container } from '@mui/material'
import { useLoaderData, useLocation } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import { Outlet, Link } from 'react-router-dom'
import 'core-js/stable/atob'
import { userData, UserRole, datacall, DataCenterEnvironment } from '@/types'
import {
  isAdmin as checkIsAdmin,
  hasAdminRead as checkHasAdminRead,
  isUnscopedWriteAdmin,
  hasUnscopedRead,
} from '@/utils/userRoles'
import { Box, Tooltip } from '@mui/material'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { groupDatacallsByYear } from '@/utils/datacallGrouping'
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
import { colors, fonts } from '@/theme/tokens'
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
  // Only the setter is needed now that the year is implied by the selected
  // call; kept as state so fetchDatacalls' initial-load reset still works.
  const [, setActiveYear] = useState<number | null>(null)
  const [activeDatacallIds, setActiveDatacallIds] = useState<number[]>([])
  const [latestDeadline, setLatestDeadline] = useState<string>('')
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [openEmailModal, setOpenEmailModal] = useState<boolean>(false)
  const [latestDatacall, setLatestDatacall] = useState<string>('')
  const [showDecommissioned, setShowDecommissioned] = useState<boolean>(false)
  const [dashboardSearch, setDashboardSearch] = useState<string>('')
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
  //
  // `resetSelection` defaults to true for the initial mount load, which snaps
  // the active year/toggles to the latest year with data. A post-create
  // refetch passes false so refreshing the list does not clobber whatever
  // year/selection the user is currently viewing - that selection flows through
  // the Outlet context to the dashboard and questionnaire.
  const fetchDatacalls = useCallback(
    async (signal?: AbortSignal, resetSelection: boolean = true) => {
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
          // Default to the latest year with data, all of its calls toggled on -
          // initial load only; a post-create refetch keeps the user's selection.
          if (resetSelection) {
            const [firstGroup] = groupDatacallsByYear(sorted)
            if (firstGroup) {
              setActiveYear(firstGroup.year)
              setActiveDatacallIds(firstGroup.calls.map((c) => c.datacallid))
            }
          }
        }
      } catch (error) {
        if (signal?.aborted) return
        console.error('Fetch latest datacall error:', error)
      }
    },
    []
  )

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
  // Single-select adapter for the redesign's DatacallContextCard picker over
  // the year-grouped multi-call model: picking a call narrows the active set
  // to just that call (and its year); clearing resets to the latest year with
  // every call toggled on, which restores the aggregated dashboard view.
  const setSelectedDatacall = useCallback(
    (dc: datacall | null) => {
      if (!dc) {
        const [firstGroup] = datacallsByYear
        if (firstGroup) {
          setActiveYear(firstGroup.year)
          setActiveDatacallIds(firstGroup.calls.map((c) => c.datacallid))
        } else {
          setActiveYear(null)
          setActiveDatacallIds([])
        }
        return
      }
      const group = datacallsByYear.find((g) =>
        g.calls.some((c) => c.datacallid === dc.datacallid)
      )
      setActiveYear(group?.year ?? null)
      setActiveDatacallIds([dc.datacallid])
    },
    [datacallsByYear]
  )

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
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
  const isHomeRoute = location.pathname === '/'
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
  // Every logged-in user gets the account menu (the logout affordance must
  // always be reachable); the admin-only action items inside are gated
  // individually, so a non-admin sees just Log out.
  const hasHeaderActions = true
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
            alignItems: 'stretch',
            justifyContent: 'space-between',
            px: { xs: 2, sm: 4 },
            height: 60,
            borderBottom: `1px solid ${colors.neutral200}`,
            minWidth: 800,
          }}
        >
          {/* left: ZTMF mark + primary nav */}
          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
            <Link
              to={Routes.ROOT}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
              }}
            >
              <img
                src={ztmfLogo}
                alt="ZTMF"
                style={{ height: 30, width: 'auto', display: 'block' }}
              />
            </Link>

            {/* primary nav tabs — underline-active, no pill background.
                Each link stretches full-height so its 2px bottom border
                sits flush at the bar's bottom edge; mb: -1px overlaps the
                header's 1px bottom border so the active underline visually
                replaces that segment instead of stacking above it. */}
            <Box
              component="nav"
              sx={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 3.5,
                fontFamily: fonts.base,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: 0,
                    background: 'transparent',
                    textDecoration: 'none',
                    color: item.active ? colors.ink : colors.neutral500,
                    fontWeight: item.active ? 600 : 500,
                    borderBottom: `2px solid ${item.active ? colors.primary : 'transparent'}`,
                    marginBottom: -1,
                    transition: 'color 120ms ease, border-color 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!item.active) e.currentTarget.style.color = colors.ink
                  }}
                  onMouseLeave={(e) => {
                    if (!item.active)
                      e.currentTarget.style.color = colors.neutral500
                  }}
                >
                  {item.label}
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
                  {/* Rendered for every logged-in user so the logout
                      affordance is always available; the admin items above
                      remain individually gated. */}
                  <MenuItem onClick={handleLogout}>Log out</MenuItem>
                </Menu>
              )}
            </Box>
          )}
        </Box>
      )}
      {/* Datacall context is rendered by each page via the shared
          DatacallContextCard component, never as chrome. */}
      {loaderData.serverError ? (
        <Container
          maxWidth={false}
          sx={{
            px: { xs: 2, sm: 4 },
            minWidth: 800,
            // Match the authenticated <main> shell: fill the column and own
            // the scroll so the CMS footer stays anchored at the viewport.
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <ServerErrorPage />
        </Container>
      ) : loaderData.status !== 200 ? (
        <Container
          maxWidth={false}
          sx={{
            px: { xs: 2, sm: 4 },
            minWidth: 800,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
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
              activeDatacallIds,
              selectedDatacall,
              setSelectedDatacall,
              showDecommissioned,
              setShowDecommissioned,
              fetchFismaSystems,
              dashboardSearch,
              setDashboardSearch,
              datacenterEnvironments,
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
        datacenterEnvironments={datacenterEnvironments}
        extendedEditable={hasUnscopedRead(userInfo)}
      />
      <EmailModal
        openModal={openEmailModal}
        closeModal={handleCloseEmailModal}
      />
      <DataCallModal
        open={openDataCallModal}
        onClose={handleDataCallClose}
        onCreated={() => fetchDatacalls(undefined, false)}
      />
      <Footer />
    </>
  )
}
