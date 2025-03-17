import Breadcrumbs from '@mui/material/Breadcrumbs'
import { useLocation, Link as RouterLink } from 'react-router-dom'
import Link, { LinkProps } from '@mui/material/Link'
import { Typography, Box } from '@mui/material'
import { capitalize } from 'lodash'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
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
          color: 'black',
        }}
      >
        Dashboard
      </Typography>
    </LinkRouter>,
  ]
  const homeText = [
    <Typography key={'homeText'} sx={{ ml: 2 }}>
      Dashboard
    </Typography>,
  ]
  const crumbs = location.pathname.split('/').filter((x) => x)
  const path = crumbs.map((value) => {
    const text = value.replace('_', ' ')
    return (
      <Typography
        sx={{ display: 'inline', whiteSpace: 'nowrap', color: '#5a5a5a' }}
        key={value}
      >
        {text[0] === text[0].toUpperCase() ? text : capitalize(text)}
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
          '& .MuiBreadcrumbs-ol': {
            flexDirection: 'row',
          },
          borderRadius: 1,
          backgroundColor: 'rgb(242,242,242)',
          p: 1,
          mb: 1,
        }}
        separator={
          <NavigateNextIcon fontSize="small" sx={{ color: '#5a5a5a' }} />
        }
      >
        {breadcrumbs}
      </Breadcrumbs>
    </Box>
  )
}
