import * as React from 'react'
import { Table, TableBody, TableCell, TableRow, TableHead } from '@mui/material'
import type { ScoreTier } from '@/types'
import { TIER_STYLES } from '@/utils/tierStyles'

// Static legend of the HHS scoring tiers. Order mirrors the maturity
// progression so a reader scans left (lowest) to right (highest). Ranges
// are expressed as the floor of each tier to match the backend Tier()
// predicate, which compares the score against >= 1.01 / 2.1 / 3.1 / 4.1.
// Closed intervals would mislead at the boundary (e.g. a score of 2.05
// is Traditional on the backend but a "1.01 - 2.0" cell suggests it is
// already Initial).
const TIER_LEGEND: Array<{ tier: ScoreTier; range: string }> = [
  { tier: 'Not Assessed', range: '< 1.01' },
  { tier: 'Traditional', range: '≥ 1.01' },
  { tier: 'Initial', range: '≥ 2.1' },
  { tier: 'Advanced', range: '≥ 3.1' },
  { tier: 'Optimal', range: '≥ 4.1' },
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
