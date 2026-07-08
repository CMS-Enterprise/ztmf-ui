import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { ScoreAggregate } from '@/types'
import { colors } from '@/theme/tokens'
import HeroRow from './components/HeroRow'
import PillarGrid from './components/PillarGrid'
import QuestionBreakdown from './QuestionBreakdown'

/** Props for {@link PillarScoresContent}. */
export interface PillarScoresContentProps {
  /** Score aggregates for the system across one or more datacalls. */
  scores: ScoreAggregate[]
  /** The datacall to show as the current period. */
  selectedDataCallId: number
  /** Stable system id, for the question-level breakdown fetch. */
  fismasystemid: number
  /** Human-readable name of the current datacall, shown in the hero stats. */
  currentDatacallName?: string
  /** Human-readable name of the previous datacall, used in the trend line. */
  previousDatacallName?: string
  /**
   * Datacall id to use as the trend baseline. Overrides the implicit
   * "most recent prior datacall on this system" lookup; lets the parent
   * page tie the trend to the user's pick from the Compare Datacalls
   * modal. Falls back to the implicit lookup when undefined.
   */
  comparisonFromDatacallId?: number
}

/**
 * Pillar Scores page body. Renders the two-card hero, the pillar grid, and
 * the question-level breakdown. This is an orchestrator only - the
 * presentational pieces live under ./components/ and the question-level
 * join lives in ./useQuestionBreakdown.ts. Three deliberate omissions
 * vs the visual mock, each driven by the locked plan:
 *
 *  - the "Comparison vs OpDiv average" radar is replaced with this system's
 *    "Current vs Previous" history radar (no OpDiv-average endpoint exists
 *    and the audit forbids fabricated comparators);
 *  - the per-question "Δ FY22" column is dropped (the plan locks "no
 *    per-question delta columns");
 *  - the "Cross-cutting" stat in the hero is omitted (ambiguous semantics).
 *
 * @param {PillarScoresContentProps} props - Component props.
 * @returns {JSX.Element} The pillar scores content block.
 */
export default function PillarScoresContent({
  scores,
  selectedDataCallId,
  fismasystemid,
  currentDatacallName,
  previousDatacallName,
  comparisonFromDatacallId,
}: PillarScoresContentProps) {
  // Latest score = the selected datacall if it has data, otherwise the
  // highest datacallid in the set. Lets the page still render the most
  // recent measurement when no datacall is picked yet.
  const latestScore =
    scores.length > 0
      ? scores.find((s) => s.datacallid === selectedDataCallId) ??
        scores.reduce((latest, current) =>
          current.datacallid > latest.datacallid ? current : latest
        )
      : null

  // Previous-score lookup respects the parent's explicit comparison pick
  // (driven by the Compare Datacalls modal) and falls back to the most
  // recent prior datacall on this system when nothing's been picked yet.
  const previousScore = useMemo(() => {
    if (!latestScore) return undefined
    if (typeof comparisonFromDatacallId === 'number') {
      return scores.find((s) => s.datacallid === comparisonFromDatacallId)
    }
    return scores
      .filter((s) => s.datacallid < latestScore.datacallid)
      .sort((a, b) => b.datacallid - a.datacallid)[0]
  }, [scores, latestScore, comparisonFromDatacallId])

  const hasValidData = Boolean(
    latestScore &&
      latestScore.pillarscores &&
      latestScore.pillarscores.length > 0
  )

  if (!latestScore || !hasValidData) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 15, fontWeight: 700, color: colors.ink, mb: 1 }}
        >
          No score data available
        </Typography>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          This system does not have any scoring data yet. Check back after the
          next datacall closes.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <HeroRow
        latestScore={latestScore}
        previousScore={previousScore}
        currentDatacallName={currentDatacallName}
        previousDatacallName={previousDatacallName}
        scores={scores}
      />
      <PillarGrid latestScore={latestScore} previousScore={previousScore} />
      <QuestionBreakdown
        fismasystemid={fismasystemid}
        datacallid={latestScore.datacallid}
      />
    </Box>
  )
}
