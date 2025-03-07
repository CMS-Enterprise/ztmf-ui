import Breadcrumbs from '@mui/material/Breadcrumbs'
import { useLocation, Link as RouterLink } from 'react-router-dom'
import Link, { LinkProps } from '@mui/material/Link'
import { Typography, Box } from '@mui/material'
import { capitalize } from 'lodash'
interface LinkRouterProps extends LinkProps {
  to: string
  replace?: boolean
}
function LinkRouter(props: LinkRouterProps) {
  return <Link {...props} component={RouterLink as any} />
}

export default function BreadCrumbs() {
  const location = useLocation()
  // let currentLink: string = ''
  const homeLink = [
    <LinkRouter underline="hover" to="/" key={'home'}>
      <Typography>Dashboard</Typography>
    </LinkRouter>,
  ]
  const homeText = [<Typography key={'homeText'}>Dashboard</Typography>]
  const crumbs = location.pathname.split('/').filter((x) => x)
  const path = crumbs.map((value) => {
    return (
      <Typography sx={{ display: 'inline', whiteSpace: 'nowrap' }} key={value}>
        {capitalize(value)}
      </Typography>
    )
  })
  const home = location.pathname === '/' ? homeText : homeLink
  const breadcrumbs = [home, ...path]

  return (
    <Box>
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          flexDirection: 'row',
          '& .MuiBreadcrumbs-ol': {
            flexDirection: 'row',
          },
        }}
        separator="›"
      >
        {breadcrumbs}
      </Breadcrumbs>
    </Box>
  )
}
