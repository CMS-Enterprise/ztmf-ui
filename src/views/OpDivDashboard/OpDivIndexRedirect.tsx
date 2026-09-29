/**
 * Landing for a bare /opdivs.
 *
 * Redirects rather than showing a picker page: the dashboard header already
 * carries an OpDiv switcher, so a picker would be a dead-end extra click for
 * every user, including an OWNER who sees all of them.
 *
 * @module views/OpDivDashboard/OpDivIndexRedirect
 */
import { Navigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import { EmptyState } from '@/components/ui/EmptyState'
import { Routes, opdivDashboardPath } from '@/router/constants'
import { hasAdminRead } from '@/utils/userRoles'
import { useContextProp } from '../Title/Context'
import {
  ALL_OPDIVS,
  canAggregate,
  needsSystemsFallback,
  preferredOpDiv,
  readLastOpDivId,
  visibleOpDivs,
} from './useOpDivScope'

/**
 * Sends the user to their preferred OpDiv dashboard.
 * @returns {JSX.Element} A spinner, a redirect, or an empty state.
 */
export default function OpDivIndexRedirect() {
  const { opdivs, opdivsLoaded, fismaSystems, fismaSystemsLoaded, userInfo } =
    useContextProp()

  // Gate on opdivsLoaded first and do NOT redirect while it is false. The
  // list is [] during Title's first fetch, so deciding here would bounce
  // every user to the dashboard on a cold load. Same for the systems list
  // when that is where the caller's scope has to come from.
  if (
    !opdivsLoaded ||
    (needsSystemsFallback(userInfo) && !fismaSystemsLoaded)
  ) {
    return (
      <Box
        sx={{
          height: '60vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress aria-label="Loading OpDivs" />
      </Box>
    )
  }

  if (!hasAdminRead(userInfo)) {
    return <Navigate to={Routes.ROOT} replace />
  }

  const visible = visibleOpDivs(userInfo, opdivs, fismaSystems)
  const remembered = preferredOpDiv(visible)
  // With several OpDivs the aggregate is the only view that covers everything
  // the caller owns, and narrowing to one is a single click from there -
  // whereas landing on whichever OpDiv sorts first is arbitrary. A remembered
  // OpDiv still wins: it is an explicit choice, and this is not.
  const landOnAggregate =
    canAggregate(visible) && readLastOpDivId(visible) === null
  const target = remembered

  if (landOnAggregate) {
    return <Navigate to={opdivDashboardPath(ALL_OPDIVS)} replace />
  }

  if (!target) {
    return (
      <Box sx={{ pt: 6 }}>
        <EmptyState
          icon={<BusinessOutlinedIcon />}
          title="No OpDivs available"
          description="Your account has admin access but no OpDiv assignments, so there is no OpDiv dashboard to show. Ask an administrator to grant you an OpDiv."
          tone="neutral"
        />
      </Box>
    )
  }

  return <Navigate to={opdivDashboardPath(target.opdiv_id)} replace />
}
