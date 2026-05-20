import * as React from 'react'
import { Table, TableBody, TableCell, TableRow, TableHead } from '@mui/material'
import type { ScoreTier } from '@/types'
import { TIER_STYLES } from '@/utils/tierStyles'

// Static legend of the HHS scoring tiers. Order mirrors the maturity
// progression so a reader scans left (lowest) to right (highest).
const TIER_LEGEND: Array<{ tier: ScoreTier; range: string }> = [
  { tier: 'Not Assessed', range: '< 1.01' },
  { tier: 'Traditional', range: '1.01 - 2.0' },
  { tier: 'Initial', range: '2.1 - 3.0' },
  { tier: 'Advanced', range: '3.1 - 4.0' },
  { tier: 'Optimal', range: '4.1 - 5.0' },
]

const ScoreTable: React.FC = (): JSX.Element => {
  return (
    <Table sx={{ minWidth: 650, maxHeight: 10, border: 1, mt: 8 }} size="small">
      <TableHead>
        <TableRow>
          {TIER_LEGEND.map(({ tier }) => (
            <TableCell
              key={`${tier}-header`}
              sx={{
                border: 1,
                backgroundColor: TIER_STYLES[tier].backgroundColor,
                color: TIER_STYLES[tier].color,
                fontWeight: 'bold',
              }}
              align="center"
            >
              {tier}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          {TIER_LEGEND.map(({ tier, range }) => (
            <TableCell key={`${tier}-range`} sx={{ border: 1 }} align="center">
              {range}
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  )
}

export default ScoreTable
