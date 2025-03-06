import Breadcrumbs from '@mui/material/Breadcrumbs'
import { useLocation, Link as RouterLink } from 'react-router-dom'
import Link, { LinkProps } from '@mui/material/Link'
import { Typography, Box } from '@mui/material'
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
  const home = [
    <LinkRouter underline="hover" to="/" key={'home'}>
      <Typography>ZTMF</Typography>
    </LinkRouter>,
  ]
  const crumbs = location.pathname.split('/').filter((x) => x)
  const path = crumbs.map((value) => {
    return (
      <Typography sx={{ display: 'inline', whiteSpace: 'nowrap' }} key={value}>
        {value}
      </Typography>
    )
  })
  const breadcrumbs = [...home, ...path]

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
