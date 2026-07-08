import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'
import type { ScoreTier } from '@/types'
import Card from './components/Card'
import ScoreCell from './components/ScoreCell'
import FilterAutocomplete from './components/FilterAutocomplete'
import BreakdownHeadCell from './components/BreakdownHeadCell'
import { breakdownCellSx } from './components/breakdownCellSx'
import { useQuestionBreakdown } from './useQuestionBreakdown'

/** Tier filter options in display order. */
const TIER_OPTIONS: ScoreTier[] = [
  'Optimal',
  'Advanced',
  'Initial',
  'Traditional',
  'Not Assessed',
]

/** Props for {@link QuestionBreakdown}. */
export type QuestionBreakdownProps = {
  /** System the breakdown is scoped to. */
  fismasystemid: number
  /** Datacall the per-question scores are pulled from. */
  datacallid: number
}

/**
 * Per-question table on the Pillar Scores page. Pulls its data through the
 * {@link useQuestionBreakdown} hook (which joins /fismasystems/{id}/questions
 * with /scores?...&include=functionoption) and lets users narrow the rows
 * by pillar and tier. Renders an empty state when the current filter
 * combination has no matches, and a "Loading..." subtitle while the fetch
 * is in-flight.
 *
 * No data fetching lives in this component directly - this is the structural
 * fix for the earlier stateful-nested-fetcher smell flagged in code review.
 * @param {QuestionBreakdownProps} props - Component props.
 * @returns {JSX.Element} The breakdown card.
 */
export default function QuestionBreakdown({
  fismasystemid,
  datacallid,
}: QuestionBreakdownProps) {
  const { rows, loading, pillarOptions } = useQuestionBreakdown(
    fismasystemid,
    datacallid
  )
  const [pillarFilter, setPillarFilter] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<ScoreTier | null>(null)

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (pillarFilter && r.pillar !== pillarFilter) return false
      if (tierFilter && r.tier !== tierFilter) return false
      return true
    })
  }, [rows, pillarFilter, tierFilter])

  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 2.25,
          py: 1.75,
          borderBottom: `1px solid ${colors.neutral200}`,
        }}
      >
        <Box>
          <Typography
            component="h2"
            sx={{ fontSize: 15, fontWeight: 700, color: colors.ink }}
          >
            Question-level breakdown
          </Typography>
          <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
            {loading
              ? 'Loading...'
              : `${rows.length} ${rows.length === 1 ? 'question' : 'questions'}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FilterAutocomplete
            options={pillarOptions}
            value={pillarFilter}
            onChange={setPillarFilter}
            placeholder="All pillars"
            ariaLabel="Filter by pillar"
          />
          <FilterAutocomplete
            options={TIER_OPTIONS}
            value={tierFilter}
            onChange={(v) => setTierFilter(v as ScoreTier | null)}
            placeholder="All tiers"
            ariaLabel="Filter by tier"
          />
        </Box>
      </Box>
      {filtered.length === 0 && !loading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
            No questions match the current filters.
          </Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <BreakdownHeadCell sx={{ width: 220 }}>
                Pillar · Function
              </BreakdownHeadCell>
              <BreakdownHeadCell>Question</BreakdownHeadCell>
              <BreakdownHeadCell align="right" sx={{ width: 200 }}>
                Score
              </BreakdownHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.scoreid}>
                <TableCell sx={breakdownCellSx}>
                  <Typography
                    sx={{ fontSize: 13, fontWeight: 600, color: colors.ink }}
                  >
                    {r.pillar}
                  </Typography>
                  {r.functionName && (
                    <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
                      {r.functionName}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={breakdownCellSx}>
                  <Typography sx={{ fontSize: 13, color: colors.ink }}>
                    {r.question}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={breakdownCellSx}>
                  <ScoreCell score={r.displayScore} tier={r.tier} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
