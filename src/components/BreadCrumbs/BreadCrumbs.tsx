import Breadcrumbs from '@mui/material/Breadcrumbs'
import { useLocation, Link as RouterLink } from 'react-router-dom'
import Link, { LinkProps } from '@mui/material/Link'
import { Typography } from '@mui/material'
import { capitalize } from 'lodash'
import { colors } from '@/theme/tokens'
import { RouteIds } from '@/router/constants'

// Fixed route segments whose casing the default formatting gets wrong:
// capitalize() lowercases everything after the first letter, so `opdivs`
// would read "Opdivs".
const ROUTE_SEGMENT_LABELS: Record<string, string> = {
  opdivs: 'OpDivs',
}

// Prefix of the admin routes (/admin/opdivs, /admin/events); see below.
const ADMIN_SEGMENT = 'admin'
interface LinkRouterProps extends LinkProps {
  to: string
  replace?: boolean
}
function LinkRouter(props: LinkRouterProps) {
  return <Link {...props} component={RouterLink as React.ElementType} />
}
interface BreadCrumbsProps {
  /** Display text for a path segment, keyed by the decoded segment. */
  segmentLabels?: Record<string, string>
  /**
   * Where a path segment's crumb links, keyed by the decoded segment. Only a
   * crumb naming a real page other than the current one should link, and the
   * page knows which those are: the system segment in a questionnaire URL, for
   * example, belongs to System Detail rather than to the questionnaire path it
   * sits in. The last crumb never links, since it is the current page.
   */
  segmentLinks?: Record<string, string>
}

/**
 * Plain breadcrumb trail ("Dashboard / ..."), no background band. The root is
 * the Dashboard, the app's landing page, and links to it; subsequent segments
 * derive from the path or the optional segmentLabels override, and link where
 * segmentLinks says so. The last crumb is marked as the current page.
 * @param {BreadCrumbsProps} props - Optional per-segment labels and links.
 * @returns {JSX.Element} The breadcrumb trail.
 */
export default function BreadCrumbs({
  segmentLabels,
  segmentLinks,
}: BreadCrumbsProps) {
  const location = useLocation()
  const isDashboard = location.pathname === '/'

  const dashboardLink = (
    <LinkRouter
      underline="hover"
      to="/"
      key="dashboard"
      sx={{ fontSize: 12, fontWeight: 500, color: colors.primary }}
    >
      Dashboard
    </LinkRouter>
  )

  // Path segments that name no page get no crumb:
  // - `admin` (/admin/opdivs, /admin/events): OpDivs and Events are top-level
  //   nav tabs like Users, so their trail should read the same way.
  // - the questionnaire's fixed `system` segment (/questionnaire/system/:id/...),
  //   which only disambiguates the route.
  const crumbs = location.pathname
    .split('/')
    .filter((x) => x)
    .filter(
      (segment, i, all) =>
        !(i === 0 && segment === ADMIN_SEGMENT) &&
        !(
          i === 1 &&
          all[0] === RouteIds.QUESTIONNAIRE &&
          segment === RouteIds.QUESTIONNAIRE_SYSTEM
        )
    )
  const path = crumbs.map((rawValue, i) => {
    const value = (() => {
      try {
        return decodeURIComponent(rawValue)
      } catch {
        return rawValue
      }
    })()
    const displayText =
      segmentLabels && segmentLabels[value]
        ? segmentLabels[value]
        : ROUTE_SEGMENT_LABELS[value] ??
          (() => {
            const text = value.replace(/[_-]/g, ' ')
            return /^[A-Z]/.test(text) ? text : capitalize(text)
          })()
    const isLast = i === crumbs.length - 1
    const to = !isLast ? segmentLinks?.[value] : undefined
    if (to) {
      return (
        <LinkRouter
          underline="hover"
          to={to}
          key={value}
          sx={{
            fontSize: 12,
            fontWeight: 500,
            color: colors.primary,
            whiteSpace: 'nowrap',
          }}
        >
          {displayText}
        </LinkRouter>
      )
    }
    return (
      <Typography
        aria-current={isLast ? 'page' : undefined}
        sx={{
          display: 'inline',
          whiteSpace: 'nowrap',
          fontSize: 12,
          fontWeight: 500,
          color: colors.neutral500,
        }}
        key={value}
      >
        {displayText}
      </Typography>
    )
  })

  // On the dashboard the trail is just "Dashboard", as plain text since it is
  // the current page. Elsewhere it starts at the Dashboard link and walks the
  // path.
  const trail = isDashboard
    ? [
        <Typography
          key="dashboard"
          aria-current="page"
          sx={{ fontSize: 12, fontWeight: 500, color: colors.neutral500 }}
        >
          Dashboard
        </Typography>,
      ]
    : [dashboardLink, ...path]

  return (
    <Breadcrumbs
      aria-label="breadcrumb"
      sx={{
        // The global stylesheet stacks list items; force a single horizontal
        // row so the trail and its separators read left to right.
        '& .MuiBreadcrumbs-ol': {
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
        },
        '& .MuiBreadcrumbs-separator': { mx: 0.75 },
      }}
      separator={
        <Typography
          component="span"
          sx={{ fontSize: 12, color: colors.neutral500 }}
        >
          /
        </Typography>
      }
    >
      {trail}
    </Breadcrumbs>
  )
}
