import Breadcrumbs from '@mui/material/Breadcrumbs'
import { useLocation, Link as RouterLink } from 'react-router-dom'
import Link, { LinkProps } from '@mui/material/Link'
import { Typography } from '@mui/material'
import { capitalize } from 'lodash'
import { colors } from '@/theme/tokens'
interface LinkRouterProps extends LinkProps {
  to: string
  replace?: boolean
}
function LinkRouter(props: LinkRouterProps) {
  return <Link {...props} component={RouterLink as React.ElementType} />
}
interface BreadCrumbsProps {
  segmentLabels?: Record<string, string>
}

/**
 * Plain breadcrumb trail ("Home / ..."), no background band. The Home root
 * always links to the dashboard; subsequent segments derive from the path or
 * the optional segmentLabels override.
 * @param {BreadCrumbsProps} props - Optional path-segment label overrides.
 * @returns {JSX.Element} The breadcrumb trail.
 */
export default function BreadCrumbs({ segmentLabels }: BreadCrumbsProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  const home = (
    <LinkRouter
      underline="hover"
      to="/"
      key="home"
      sx={{ fontSize: 12, fontWeight: 500, color: colors.primary }}
    >
      Home
    </LinkRouter>
  )

  const crumbs = location.pathname.split('/').filter((x) => x)
  const path = crumbs.map((rawValue) => {
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
        : (() => {
            const text = value.replace(/[_-]/g, ' ')
            return /^[A-Z]/.test(text) ? text : capitalize(text)
          })()
    return (
      <Typography
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

  // On the dashboard the path is empty, so show "Home / Dashboard" explicitly.
  const trail = isHome
    ? [
        home,
        <Typography
          key="dashboard"
          sx={{ fontSize: 12, fontWeight: 500, color: colors.neutral500 }}
        >
          Dashboard
        </Typography>,
      ]
    : [home, ...path]

  return (
    <Breadcrumbs
      aria-label="breadcrumb"
      sx={{ '& .MuiBreadcrumbs-separator': { mx: 0.75 } }}
      separator={
        <Typography
          component="span"
          sx={{ fontSize: 12, color: colors.neutral400 }}
        >
          /
        </Typography>
      }
    >
      {trail}
    </Breadcrumbs>
  )
}
