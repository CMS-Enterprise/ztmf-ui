import * as React from 'react'
import { Typography } from '@mui/material'

interface TABLETITLEPROPS {
  system: string
  pillarType: string
}
const TableTitle: React.FC<TABLETITLEPROPS> = ({
  system,
  pillarType,
}): JSX.Element => {
  return (
    <Typography
      variant="h3"
      sx={{ my: 2, fontSize: '2.125rem' }}
      align="center"
    >
      {system} Maturity {pillarType} Score Pillars
    </Typography>
  )
}

export default TableTitle
