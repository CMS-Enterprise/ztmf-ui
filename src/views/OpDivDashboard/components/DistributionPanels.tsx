/**
 * The distribution figures: maturity stage, pillar averages, score by system,
 * and the four metadata breakdowns.
 *
 * All of them are labeled bar lists. See BarList for why a distribution here
 * is never a pie or a stacked bar.
 *
 * @module views/OpDivDashboard/components/DistributionPanels
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, fonts } from '@/theme/tokens'
import type { datacall } from '@/types'
import BarList, { type BarListItem } from '@/components/ScoreSummary/BarList'
import ChartCard from '@/components/ScoreSummary/ChartCard'
import ShowAllToggle from './ShowAllToggle'
import { useExpandableRows } from './useExpandableRows'
import StagePie from './StagePie'
import { stageColor } from '@/components/ScoreSummary/stageColor'
import {
  scoreSpread,
  splitExtremes,
  type SystemScoreBar,
} from '../opdivAggregates'
import type { Breakdown, OverlappingBreakdown } from '../opdivBreakdowns'
import type { TierMovement } from '../opdivTrend'
import type { PillarAverage, PillarExtremeCounts } from '../opdivPillars'
import type { OpDivAverage } from '../opdivByOpDiv'

// Score bars are read against the scale, not against each other. The scale is
// 1.0-5.0, so both ends matter: measuring from zero would render the floor as
// a fifth-full bar and squeeze the real spread into the remaining four fifths.
const MAX_SCORE = 5
const MIN_SCORE = 1

/**
 * Maturity stage distribution, one labeled row per tier.
 * @param {{ stage: Breakdown }} props - The stage partition.
 * @returns {JSX.Element} The stage card.
 */
export function StagePanel({
  stage,
  movement,
  priorLabel,
}: {
  stage: Breakdown
  movement?: TierMovement
  priorLabel?: string
}) {
  return (
    <ChartCard
      eyebrow="Maturity stage"
      subtitle="Share of systems by tier"
      info="Where each system sits on the 1.0-5.0 maturity scale: Optimal from 4.10, Advanced from 3.10, Initial from 2.10, Traditional from 1.01. Not Assessed means the system is in the call but unanswered; No score means it has no score row at all."
    >
      <StagePie stage={stage} movement={movement} priorLabel={priorLabel} />
    </ChartCard>
  )
}

/**
 * Average score per pillar across the OpDiv.
 * @param {object} props - Averages, the anchor call and pending state.
 * @returns {JSX.Element} The pillar card.
 */
export function PillarPanel({
  averages,
  extremes,
  anchorCall,
  priorLabel,
  isPending,
}: {
  averages: PillarAverage[]
  extremes: PillarExtremeCounts
  anchorCall: datacall | null
  priorLabel?: string
  isPending: boolean
}) {
  // Each bar carries its band and its movement. A shorter denominator is
  // shown, not implied: a reduced-scope system emits no row for its excluded
  // pillars, so those bars average over fewer systems.
  const items: BarListItem[] = averages.map((p) => {
    const parts: string[] = [p.tier]
    if (p.delta !== null && Math.abs(p.delta) >= 0.005) {
      parts.push(`${p.delta > 0 ? '+' : ''}${p.delta.toFixed(2)}`)
    }
    if (p.outOfScope > 0) parts.push(`${p.n} of ${p.n + p.outOfScope} in scope`)
    return {
      label: p.pillar,
      value: p.avg,
      display: p.avg.toFixed(2),
      // Banded, not a value-ramp: the tier boundaries are not inferable from
      // bar length (3.02 and 3.20 look alike but straddle the Advanced line),
      // and a single-series chart has no competing use for the colour channel.
      color: stageColor(p.tier),
      note: parts.join(' · '),
    }
  })
  // Having a baseline is not the same as having movement. Carried-forward
  // answers leave every pillar exactly where it was, and a "Change shown
  // vs..." caption above bars that show no change reads as a bug.
  const hasBaseline = averages.some((p) => p.delta !== null)
  const hasDeltas = averages.some(
    (p) => p.delta !== null && Math.abs(p.delta) >= 0.005
  )

  return (
    <ChartCard
      eyebrow="Average score by pillar"
      info="Each pillar averaged across the systems scored on it. SaaS systems are scored on four pillars rather than six, so a bar noting a shorter denominator is measuring fewer systems, not scoring worse."
      // Named because the tiles may aggregate several calls while this shows
      // one - silently disagreeing is worse than saying so.
      subtitle={anchorCall ? anchorCall.datacall : 'Selected data call'}
    >
      <BarList
        items={items}
        max={MAX_SCORE}
        min={MIN_SCORE}
        emptyMessage={
          isPending
            ? 'Loading pillar scores…'
            : 'No pillar scores for this call.'
        }
      />
      {(extremes.weakest || hasBaseline) && (
        <Box
          sx={{
            mt: 'auto',
            pt: 1,
            borderTop: `1px solid ${colors.neutral200}`,
          }}
        >
          {/* Where the OpDiv actually loses points, which the six averages
              cannot say: a mid-range average can mean a few terrible systems
              or uniformly mediocre ones, and those need different responses. */}
          {extremes.weakest && (
            <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
              Lowest pillar for most systems:{' '}
              <Box component="span" sx={{ fontWeight: 700, color: colors.ink }}>
                {extremes.weakest.pillar}
              </Box>{' '}
              ({extremes.weakest.count} of {extremes.systems})
              {extremes.strongest && (
                <>
                  {' · highest: '}
                  <Box
                    component="span"
                    sx={{ fontWeight: 700, color: colors.ink }}
                  >
                    {extremes.strongest.pillar}
                  </Box>{' '}
                  ({extremes.strongest.count})
                </>
              )}
            </Typography>
          )}
          {hasBaseline && (
            <Typography
              sx={{ fontSize: 11, color: colors.neutral500, mt: 0.25 }}
            >
              {hasDeltas
                ? `Change shown vs ${priorLabel ?? 'the prior call'}, paired by system.`
                : `No pillar movement vs ${priorLabel ?? 'the prior call'}, paired by system.`}
            </Typography>
          )}
        </Box>
      )}
    </ChartCard>
  )
}

/**
 * Score by system, highest first.
 * @param {{ bars: SystemScoreBar[]; unscored: number }} props - Bars and the unscored count.
 * @returns {JSX.Element} The by-system card.
 */
export function SystemScorePanel({
  bars,
  unscored,
}: {
  bars: SystemScoreBar[]
  unscored: number
}) {
  const toItem = (bar: SystemScoreBar): BarListItem => ({
    label: bar.acronym,
    value: bar.score,
    display: bar.score.toFixed(2),
    color: stageColor(bar.tier),
    // The tier is text, so the band never depends on telling fills apart.
    note: bar.tier,
  })
  const {
    listed: allListed,
    hidden: cappedHidden,
    expanded,
    toggle,
    cappedAtMax,
  } = useExpandableRows(bars, bars.length)
  const { top, bottom, hiddenCount } = splitExtremes(bars)
  const spread = scoreSpread(bars)

  return (
    <ChartCard
      eyebrow="Score by system"
      info="The highest and lowest scoring systems; the middle is omitted, and the full ranking is in the systems table below. Median and range sit under the bars because a tail of unanswered systems pulls the average away from where most systems actually are."
      subtitle={
        unscored > 0
          ? `${bars.length} scored · ${unscored} not scored`
          : `${bars.length} scored`
      }
    >
      <BarList
        items={(expanded ? allListed : top).map(toItem)}
        max={MAX_SCORE}
        min={MIN_SCORE}
        labelWidth={88}
        emptyMessage="No scored systems in this OpDiv yet."
      />
      {hiddenCount > 0 && !expanded && (
        <>
          {/* Says what was left out rather than trailing off. The full ranking
              is in the systems table below, so nothing here is the only way
              to reach a value. */}
          <Typography
            sx={{
              fontSize: 11,
              color: colors.neutral500,
              py: 0.5,
              borderTop: `1px solid ${colors.neutral200}`,
              borderBottom: `1px solid ${colors.neutral200}`,
              my: 0.5,
            }}
          >
            {hiddenCount} more {hiddenCount === 1 ? 'system' : 'systems'} in
            between — see the table below
          </Typography>
          <BarList
            items={bottom.map(toItem)}
            max={MAX_SCORE}
            min={MIN_SCORE}
            labelWidth={88}
          />
        </>
      )}
      {(hiddenCount > 0 || expanded) && (
        <ShowAllToggle
          hidden={expanded ? cappedHidden : hiddenCount}
          expanded={expanded}
          onToggle={toggle}
          noun={`${bars.length} systems`}
          cappedAtMax={cappedAtMax}
          total={bars.length}
        />
      )}
      {spread && (
        <Typography
          sx={{
            mt: 'auto',
            pt: 1,
            fontSize: 12,
            color: colors.neutral500,
            borderTop: `1px solid ${colors.neutral200}`,
          }}
        >
          {/* Median beside the headline average: a tail of systems at the 1.00
              floor drags a mean somewhere no real system sits, and the two
              diverging is the signal that the OpDiv is split, not mid-range. */}
          Median{' '}
          <Box
            component="span"
            sx={{ fontFamily: fonts.mono, fontWeight: 700, color: colors.ink }}
          >
            {spread.median.toFixed(2)}
          </Box>{' '}
          · range{' '}
          <Box
            component="span"
            sx={{ fontFamily: fonts.mono, fontWeight: 700, color: colors.ink }}
          >
            {spread.min.toFixed(2)}–{spread.max.toFixed(2)}
          </Box>
        </Typography>
      )}
    </ChartCard>
  )
}

/**
 * One metadata partition as a bar list.
 * @param {{ eyebrow: string; breakdown: Breakdown }} props - Title and partition.
 * @returns {JSX.Element} A breakdown card.
 */
export function PartitionPanel({
  eyebrow,
  breakdown,
}: {
  eyebrow: string
  breakdown: Breakdown
}) {
  return (
    <ChartCard eyebrow={eyebrow}>
      <BarList
        items={breakdown.buckets.map((b) => ({
          label: b.label,
          value: b.count,
          display: `${b.count}`,
        }))}
        max={breakdown.total}
        labelWidth={92}
        emptyMessage="No systems."
      />
    </ChartCard>
  )
}

/**
 * Cloud service models in use. Counts overlap by construction, so the card
 * says so rather than inviting a part-of-whole reading.
 * @param {{ breakdown: OverlappingBreakdown }} props - The overlapping counts.
 * @returns {JSX.Element} The service-model card.
 */
export function ServiceModelPanel({
  breakdown,
}: {
  breakdown: OverlappingBreakdown
}) {
  return (
    <ChartCard
      eyebrow="Cloud service model"
      info="Counts overlap: a system running both IaaS and PaaS appears in both rows, so they do not sum to the system total. This is not the field that decides questionnaire scope - that is the datacenter environment."
      subtitle="Systems may use more than one"
    >
      <BarList
        items={breakdown.buckets.map((b) => ({
          label: b.label,
          value: b.count,
          display: `${b.count}`,
        }))}
        max={breakdown.denominator}
        labelWidth={92}
        emptyMessage="No cloud service models recorded."
      />
      {breakdown.unspecified > 0 && (
        <Typography sx={{ fontSize: 11, color: colors.neutral500 }}>
          {breakdown.unspecified} cloud{' '}
          {breakdown.unspecified === 1 ? 'system has' : 'systems have'} no
          service model recorded.
        </Typography>
      )}
    </ChartCard>
  )
}

/**
 * Average score per OpDiv - the aggregate view's own figure.
 *
 * Scored against the 1-5 scale rather than against each other, so a leading
 * OpDiv does not render as a full bar when it is mid-range in absolute terms.
 * @param {{ rows: OpDivAverage[] }} props - Per-OpDiv averages.
 * @returns {JSX.Element} The by-OpDiv card.
 */
export function OpDivScorePanel({ rows }: { rows: OpDivAverage[] }) {
  const scored = rows.filter((r) => r.avg !== null)
  const unscored = rows.length - scored.length
  return (
    <ChartCard
      eyebrow="Score by OpDiv"
      info="Each OpDiv averaged over its own scored systems. Bars are measured against the 1.0-5.0 scale rather than against each other, so a leading OpDiv does not fill the bar unless it is genuinely near Optimal."
      subtitle={
        unscored > 0
          ? `${scored.length} scored · ${unscored} with no scored systems`
          : `${scored.length} ${scored.length === 1 ? 'OpDiv' : 'OpDivs'}`
      }
    >
      <BarList
        items={scored.map((r) => ({
          label: r.code,
          value: r.avg as number,
          display: (r.avg as number).toFixed(2),
          color: r.tier ? stageColor(r.tier) : undefined,
          note: `${r.tier} · ${r.scored} of ${r.systems} scored`,
        }))}
        max={MAX_SCORE}
        min={MIN_SCORE}
        labelWidth={80}
        emptyMessage="No scored systems in any OpDiv yet."
      />
      {unscored > 0 && (
        <Typography sx={{ fontSize: 11, color: colors.neutral500, mt: 0.5 }}>
          {/* Named rather than dropped: an OpDiv with systems but no scores is
              a different finding from one with no systems. */}
          No scored systems:{' '}
          {rows
            .filter((r) => r.avg === null)
            .map((r) => r.code)
            .join(', ')}
        </Typography>
      )}
    </ChartCard>
  )
}
