import { Container } from '@mui/material'
import { useLoaderData, useLocation } from 'react-router-dom'
import { UsaBanner } from '@cmsgov/design-system'
import { Outlet, Link } from 'react-router-dom'
import 'core-js/stable/atob'
import { userData, datacall, DataCenterEnvironment, OpDiv } from '@/types'
import { EMPTY_USER } from '@/constants'
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
import { notify, isAuthHandled } from '@/utils/notify'
import { fetchOpDivs } from '@/utils/opdivs'
import { broadcastLogout } from '@/utils/sessionSync'
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

// Fixed text, not parseApiError: this fires from the shell on any page, so a
// generic "something went wrong" would give the user nothing to act on.
const OPDIVS_LOAD_ERROR =
  'Failed to load the OpDiv list. OpDiv names and pickers may be incomplete - please reload.'

export default function Title() {
  const location = useLocation()
  const loaderData = useLoaderData() as AuthLoaderData
  const [openDataCallModal, setOpenDataCallModal] = useState<boolean>(false)
  const userInfo: userData =
    loaderData.status != 200 ? EMPTY_USER : loaderData.response
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
  const [activeYear, setActiveYear] = useState<number | null>(null)
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
  const [opdivs, setOpdivs] = useState<OpDiv[]>([])
  // Distinguishes "not fetched yet" from "fetched, and there are none" - both
  // are an empty list. The questionnaire's insights gate needs the difference.
  const [opdivsLoaded, setOpdivsLoaded] = useState(false)

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
  // Fetched once for the five pages that read OpDivs, and re-invoked by OpDiv
  // admin after a write. Includes inactive rows so a system tied to a
  // deactivated OpDiv still resolves its name. Unlike the sibling fetches
  // above this notifies rather than logs: it is the only fetch site, so an
  // empty list persists for the session and leaves the system form's Save stuck.
  const refreshOpdivs = useCallback((signal?: AbortSignal) => {
    fetchOpDivs(true, signal)
      .then(setOpdivs)
      .catch((error) => {
        if (signal?.aborted || isAuthHandled(error)) return
        notify(OPDIVS_LOAD_ERROR, 'error')
      })
      .finally(() => {
        // Settled either way: a failure resolves to "no OpDivs" rather than
        // leaving consumers blocked on a load that will never arrive.
        if (!signal?.aborted) setOpdivsLoaded(true)
      })
  }, [])

  useEffect(() => {
    if (loaderData.status !== 200) return
    const controller = new AbortController()
    refreshOpdivs(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loaderData.status, refreshOpdivs])

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
  // Multi-select toggle for the picker's checkbox rows (#467 semantics):
  // selecting a call in a different year switches to that whole year (all
  // calls on); within the active year, toggle a call but never leave the
  // year empty. The dashboard aggregates whatever set is toggled on.
  const toggleActiveDatacall = useCallback(
    (dc: datacall) => {
      const group = datacallsByYear.find((g) =>
        g.calls.some((c) => c.datacallid === dc.datacallid)
      )
      if (!group) return
      if (group.year !== activeYear) {
        setActiveYear(group.year)
        setActiveDatacallIds(group.calls.map((c) => c.datacallid))
        return
      }
      setActiveDatacallIds((prev) => {
        const removing = prev.includes(dc.datacallid)
        if (removing && prev.length === 1) return prev // never empty the year
        const next = new Set(prev)
        if (removing) {
          next.delete(dc.datacallid)
        } else {
          next.add(dc.datacallid)
        }
        // Keep the group's deadline order (newest first) so the dashboard
        // merge deterministically resolves a multi-call system to its
        // newest call.
        return group.calls.map((c) => c.datacallid).filter((id) => next.has(id))
      })
    },
    [datacallsByYear, activeYear]
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
    // Best-effort and independent of the POST result, matching the "even if
    // the request fails we still drop to sign-in" contract above.
    broadcastLogout()
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
      // OWNER manages OpDivs fully; an HHS admin reaches the page only to
      // flip the per-OpDiv System Delegate toggle.
      show: isUnscopedWriteAdmin(userInfo),
    },
    {
      label: 'Events',
      to: Routes.ADMIN_EVENTS,
      active: location.pathname.startsWith('/admin/events'),
      // hasUnscopedRead, not hasAdminRead: the events endpoint 403s an
      // OpDiv-scoped admin, so scoped tiers do not get the tab.
      show: hasUnscopedRead(userInfo),
    },
  ].filter((item) => item.show)
  // Every logged-in user gets the account menu (the logout affordance must
  // always be reachable); the admin-only action items inside are gated
  // individually, so a non-admin sees just Log out.
  const hasHeaderActions = true
  return (
    <>
      {/* Skip link: first tab stop, visually hidden until focused. A button
          with programmatic focus (not an href="#..." anchor) because the app
          uses hash routing - an in-page fragment would be swallowed by the
          router as a navigation. */}
      {!isSignInRoute && loaderData.status === 200 && (
        <Box
          component="button"
          type="button"
          onClick={() => {
            const main = document.getElementById('main-content')
            if (main) {
              main.focus()
              main.scrollIntoView()
            }
          }}
          sx={{
            position: 'absolute',
            left: -9999,
            top: 0,
            zIndex: 2000,
            px: 2,
            py: 1,
            fontSize: 14,
            fontWeight: 600,
            color: colors.white,
            backgroundColor: colors.primary,
            border: 'none',
            borderRadius: `0 0 4px 0`,
            cursor: 'pointer',
            '&:focus-visible': { left: 0 },
          }}
        >
          Skip to main content
        </Box>
      )}
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
                {/* A real button element (not a role="button" Box) so the
                    account menu - the only path to Log out - is reachable
                    and operable by keyboard and announced correctly. */}
                <Box
                  component="button"
                  type="button"
                  aria-controls={hasHeaderActions ? 'actions-menu' : undefined}
                  aria-haspopup={hasHeaderActions ? 'true' : undefined}
                  aria-expanded={
                    hasHeaderActions ? Boolean(anchorEl) : undefined
                  }
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
                    backgroundColor: 'transparent',
                    font: 'inherit',
                    border: hasHeaderActions
                      ? `1px solid ${colors.neutral200}`
                      : 'none',
                    ...(hasHeaderActions && {
                      '&:hover': { backgroundColor: colors.neutral50 },
                    }),
                    '&:focus-visible': {
                      outline: `2px solid ${colors.primary}`,
                      outlineOffset: 2,
                    },
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
            // Fill the shell column so the CMS footer sits at the bottom of
            // short pages; taller content pushes it down (document scroll).
            flex: 1,
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
          }}
        >
          <LoginPage />
        </Container>
      ) : (
        // Full-bleed gray canvas: the background spans the viewport while the
        // page content stays padded to the same gutters as the header.
        <Box
          component="main"
          id="main-content"
          // Focus target for the skip link; -1 keeps it out of the natural
          // tab order while allowing programmatic focus.
          tabIndex={-1}
          sx={{
            backgroundColor: colors.neutral50,
            minWidth: 800,
            outline: 'none',
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
              toggleActiveDatacall,
              showDecommissioned,
              setShowDecommissioned,
              fetchFismaSystems,
              dashboardSearch,
              setDashboardSearch,
              datacenterEnvironments,
              opdivs,
              opdivsLoaded,
              refreshOpdivs,
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
        opdivs={opdivs}
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
