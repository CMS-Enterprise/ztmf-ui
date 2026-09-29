/**
 * The dashboard's top row, ordered by severity rather than by inventory.
 *
 * It used to be eight tiles of standing facts - systems, HVAs, High FIPS,
 * highest and lowest score - with the two alarming numbers (nothing started,
 * a third of the estate unscored) demoted to grey hint text underneath them.
 * A reader opening this page wants to know what needs doing, and the answer
 * was the smallest text on the screen.
 *
 * So the first four tiles are the things that need action, worst first, and
 * every one of them goes quiet and green when there is nothing to chase. The
 * second row carries the standing facts at the same weight it always had.
 *
 * Every tile explains itself on hover. These are compressed counts with real
 * rules behind them - what "not started" counts, which systems a decline is
 * measured over - and a number whose rule is not stated is a number that gets
 * misread. The qualifiers that used to trail the tiles as fine print live in
 * those explanations now.
 *
 * @module views/OpDivDashboard/components/OpDivKpiRow
 */
import Box from '@mui/material/Box'
import { colors } from '@/theme/tokens'
import KpiTile from './KpiTile'
import type {
  CompletionSummary,
  OpDivSummary,
  RiskSummary,
} from '../opdivAggregates'
import type { PairedDelta } from '../opdivTrend'

/** Anchor on the panel naming the systems with no progress. */
export const NOT_STARTED_PANEL_ID = 'opdiv-not-started'
/** Anchor on the panel naming the high-impact systems below the floor. */
export const RISK_PANEL_ID = 'opdiv-risk'
/** Below this many days left, the deadline reads as urgent rather than noted. */
const DEADLINE_URGENT_DAYS = 14

/** Props for {@link OpDivKpiRow}. */
export type OpDivKpiRowProps = {
  summary: OpDivSummary
  completion: CompletionSummary
  risk: RiskSummary
  /** Paired movement vs the prior call - the source of the declined count. */
  delta: PairedDelta
  /** The baseline call the declined count compares against. */
  priorLabel?: string
  /** Whole days until the open call's deadline; negative once it has passed. */
  daysRemaining: number | null
}

/**
 * Renders the four alert tiles and the four standing-fact tiles below them.
 * @param {OpDivKpiRowProps} props - The summaries behind every figure.
 * @returns {JSX.Element} The KPI grid.
 */
export default function OpDivKpiRow({
  summary,
  completion,
  risk,
  delta,
  priorLabel,
  daysRemaining,
}: OpDivKpiRowProps) {
  // The deadline is the reason "not started" is urgent, so it rides on that
  // tile rather than occupying one of its own.
  const deadlineNote =
    daysRemaining === null
      ? undefined
      : daysRemaining < 0
        ? 'deadline passed'
        : daysRemaining === 0
          ? 'due today'
          : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`

  const notStarted = completion.notStarted
  const unscored = summary.unscoredCount
  const atRisk = risk.belowFloor.length
  const declined = delta.declined

  // The composition behind the risk denominator, which nothing else on the
  // page states. Unrecorded flags are named rather than folded into the
  // negative - an unrecorded flag is not a recorded "no".
  const impactInfo = [
    risk.highImpact > 0
      ? `${risk.highImpact} high-impact ${risk.highImpact === 1 ? 'system' : 'systems'} in scope: ${summary.hvaCount} HVA, ${summary.highFipsCount} High FIPS.`
      : 'No system here is flagged an HVA or carries a High FIPS impact level.',
    risk.unknownImpact > 0
      ? `${risk.unknownImpact} ${risk.unknownImpact === 1 ? 'system has' : 'systems have'} neither designation recorded, so their impact is unknown rather than low.`
      : null,
    risk.unscored > 0
      ? `${risk.unscored} high-impact ${risk.unscored === 1 ? 'system has' : 'systems have'} no score to judge, and are excluded from this count.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <KpiTile
          label="Not started"
          value={
            completion.systemsInCall > 0
              ? `${notStarted}/${completion.systemsInCall}`
              : '—'
          }
          // A carried-forward questionnaire nobody has confirmed counts as not
          // started, matching the warning chip the systems table gives it.
          hint={
            notStarted > 0
              ? [
                  completion.awaitingConfirmation > 0
                    ? `${completion.awaitingConfirmation} awaiting confirmation`
                    : 'no progress this cycle',
                  deadlineNote,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : `all ${completion.systemsInCall} underway`
          }
          tone={
            notStarted === 0
              ? 'good'
              : daysRemaining !== null && daysRemaining <= DEADLINE_URGENT_DAYS
                ? 'danger'
                : 'warning'
          }
          jumpToId={notStarted > 0 ? NOT_STARTED_PANEL_ID : undefined}
          info={`Systems in the data call with nothing confirmed this cycle, out of the ${completion.systemsInCall} the call expects answers from. Answers carried forward from last cycle do not count as progress until someone confirms them, so a system with a full questionnaire can still appear here.${notStarted > 0 ? ' Opens the list of systems to chase.' : ''}`}
        />
        <KpiTile
          label="High impact at risk"
          value={risk.highImpact > 0 ? `${atRisk}/${risk.highImpact}` : '—'}
          hint={
            risk.highImpact === 0
              ? 'none flagged HVA or High FIPS'
              : atRisk > 0
                ? 'HVA or High FIPS below Advanced'
                : 'all at Advanced or above'
          }
          tone={
            atRisk > 0 ? 'danger' : risk.highImpact > 0 ? 'good' : 'neutral'
          }
          jumpToId={atRisk > 0 ? RISK_PANEL_ID : undefined}
          info={`Systems where a weakness costs the most: flagged an HVA or carrying a High FIPS impact level, and scoring below Advanced. ${impactInfo}`}
        />
        <KpiTile
          label="Unscored"
          value={`${unscored}/${summary.systemCount}`}
          // A system with no score row was never enrolled - a gap in coverage,
          // not a bad result, so it is amber rather than red.
          hint={unscored > 0 ? 'no score in this call' : 'every system scored'}
          tone={unscored > 0 ? 'warning' : 'good'}
          info="Systems with no score row in this data call - they were never enrolled in it. That is a different state from being assessed and scoring badly: a system sitting at the 1.00 floor was enrolled and left unanswered, and it counts as scored."
        />
        <KpiTile
          label="Declining scores"
          value={delta.n > 0 ? declined : '—'}
          hint={
            delta.n === 0
              ? 'no prior call to compare'
              : declined > 0
                ? `of ${delta.n} scored in both${priorLabel ? ` · vs ${priorLabel}` : ''}`
                : `none of ${delta.n} lost ground`
          }
          tone={declined > 0 ? 'danger' : delta.n > 0 ? 'good' : 'neutral'}
          info={
            delta.n === 0
              ? 'Systems scoring lower than they did in the previous data call. There is no earlier call with systems in common, so there is nothing to compare against yet.'
              : `Systems scoring lower than they did in ${priorLabel ?? 'the previous data call'}, counted over the ${delta.n} scored in both calls. Systems scored in only one of the two are excluded, so a changed system mix cannot register as a decline. Worth reading beside the overall change: the average can hold steady while individual systems move in both directions.`
          }
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <KpiTile
          label="Systems"
          value={summary.systemCount.toLocaleString('en-US')}
          hint={`${completion.systemsInCall.toLocaleString('en-US')} in this call`}
          info="Active systems attributed to this OpDiv. Decommissioned systems are excluded from every figure on this page, whatever the Show decommissioned toggle is set to elsewhere in the app."
        />
        <KpiTile
          label="At Advanced or better"
          value={
            summary.scoredCount > 0
              ? `${summary.optimalAdvancedCount}/${summary.scoredCount}`
              : '—'
          }
          hint={
            summary.scoredCount > 0
              ? `${Math.round((summary.optimalAdvancedCount / summary.scoredCount) * 100)}% of scored systems`
              : 'nothing scored yet'
          }
          valueColor={
            summary.optimalAdvancedCount > 0 ? colors.up : colors.neutral400
          }
          info="Scored systems holding Optimal or Advanced. Measured over the systems with a score, not over every system - a system that was never enrolled has no tier to hold, and counting it as a miss would understate the OpDiv."
        />
        <KpiTile
          label="Highest score"
          value={summary.highest ? summary.highest.score.toFixed(2) : '—'}
          hint={summary.highest?.acronym}
          valueColor={summary.highest ? colors.up : colors.neutral400}
        />
        <KpiTile
          label="Lowest score"
          value={summary.lowest ? summary.lowest.score.toFixed(2) : '—'}
          hint={summary.lowest?.acronym}
          valueColor={summary.lowest ? colors.down : colors.neutral400}
          info="The weakest scored system. A 1.00 is the scale floor, which usually means a system enrolled in the call with nothing answered rather than one assessed as failing."
        />
      </Box>
    </Box>
  )
}
