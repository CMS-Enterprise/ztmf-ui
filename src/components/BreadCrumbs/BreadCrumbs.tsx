import Breadcrumbs from '@mui/material/Breadcrumbs'
import { useLocation, Link as RouterLink } from 'react-router-dom'
import Link, { LinkProps } from '@mui/material/Link'
import { Typography, Box } from '@mui/material'
import { capitalize } from 'lodash'
import { red } from '@mui/material/colors'
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
      <Typography
        sx={{
          ml: 2,
          color: 'white',
        }}
      >
        Dashboard
      </Typography>
    </LinkRouter>,
  ]
  const homeText = [
    <Typography key={'homeText'} sx={{ ml: 2, color: '#a6a6a6' }}>
      Dashboard
    </Typography>,
  ]
  const crumbs = location.pathname.split('/').filter((x) => x)
  const path = crumbs.map((value) => {
    const text = value.replace('_', ' ')
    return (
      <Typography
        sx={{ display: 'inline', whiteSpace: 'nowrap', color: '#a6a6a6' }}
        key={value}
      >
        {capitalize(text)}
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
          // display: 'flex',
          // flexWrap: 'nowrap',
          // flexDirection: 'row',
          '& .MuiBreadcrumbs-ol': {
            flexDirection: 'row',
          },
          backgroundColor: '#0d2499',
          borderRadius: 1,
          // color: 'white',
          mb: 1,
        }}
        separator="›"
      >
        {breadcrumbs}
      </Breadcrumbs>
    </Box>
  )
}
