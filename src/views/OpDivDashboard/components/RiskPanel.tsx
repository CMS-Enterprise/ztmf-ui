/**
 * High-impact systems that have not reached the maturity floor.
 *
 * This slot used to hold the target-maturity gap on its own, which was three
 * counts and a mostly-empty card - no CMS system has a target asserted yet, so
 * it was structurally empty and will stay that way until ISSOs set them. The
 * risk list needs no new data to be useful today: impact comes from flags the
 * catalog already records, and it answers the question the rest of the page
 * does not - not "how mature is this OpDiv" but "where does the weakness cost
 * the most". The target summary survives as the footer line it deserved.
 *
 * @module views/OpDivDashboard/components/RiskPanel
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import Link from '@mui/material/Link'
import { colors, fonts, radius } from '@/theme/tokens'
import ChartCard from './ChartCard'
import ShowAllToggle from './ShowAllToggle'
import { useExpandableRows } from './useExpandableRows'
import { stageColor } from './stageColor'
import {
  RISK_TIER_FLOOR,
  type RiskRow,
  type RiskSummary,
  type TargetGap,
} from '../opdivAggregates'

/** Explains the figure in the card header. */
const RISK_INFO = `A system counts as high impact when it is flagged an HVA or carries a High FIPS impact level, and as low maturity when its scored tier is below ${RISK_TIER_FLOOR}. Systems with neither flag recorded are counted apart rather than assumed low impact - an unrecorded flag is an unanswered question, not a no.`

/** How many systems to name before summarizing the remainder. */
const MAX_LISTED = 6

/** Props for {@link RiskPanel}. */
export type RiskPanelProps = {
  risk: RiskSummary
  /** Target-maturity coverage, summarized as the footer line. */
  gap: TargetGap
  /** Scroll anchor, for the jump from the High impact at risk tile. */
  id?: string
}

/**
 * One named system with its tier and why it counts as high impact.
 * @param {{ row: RiskRow }} props - The system.
 * @returns {JSX.Element} The row.
 */
function RiskListRow({ row }: { row: RiskRow }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.45,
      }}
    >
      <Link
        component={RouterLink}
        to={`/systems/${row.system.fismasystemid}`}
        underline="hover"
        sx={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {row.system.fismaacronym}
      </Link>
      {/* Why it is on this list, stated rather than implied by placement. */}
      <Box sx={{ display: 'flex', gap: 0.5, flex: 1, minWidth: 0 }}>
        {row.reasons.map((reason) => (
          <Typography
            key={reason}
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: colors.neutral700,
              backgroundColor: colors.neutral100,
              borderRadius: `${radius.sm}px`,
              px: 0.6,
              py: 0.15,
              whiteSpace: 'nowrap',
            }}
          >
            {reason}
          </Typography>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flexShrink: 0,
        }}
      >
        {/* The tier is named, so the dot beside it is reinforcement and never
            the only channel carrying it. */}
        <Box
          aria-hidden="true"
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: stageColor(row.tier ?? ''),
          }}
        />
        <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
          {row.tier}
        </Typography>
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: colors.ink,
            minWidth: 30,
            textAlign: 'right',
          }}
        >
          {row.score !== undefined ? row.score.toFixed(2) : '—'}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * Renders the high-impact risk list and the target-coverage footer.
 * @param {RiskPanelProps} props - The risk summary and target gap.
 * @returns {JSX.Element} The card.
 */
export default function RiskPanel({ risk, gap, id }: RiskPanelProps) {
  const { listed, hidden, expanded, toggle, cappedAtMax } = useExpandableRows(
    risk.belowFloor,
    MAX_LISTED
  )
  const targetJudged = gap.atOrAbove + gap.below

  return (
    <ChartCard
      id={id}
      eyebrow="High impact, low maturity"
      subtitle={`HVA or High FIPS systems scoring below ${RISK_TIER_FLOOR}`}
      info={RISK_INFO}
      sx={{ height: '100%' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1,
            color: risk.belowFloor.length > 0 ? colors.down : colors.up,
          }}
        >
          {risk.highImpact > 0 ? risk.belowFloor.length : '—'}
        </Typography>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          {risk.highImpact > 0
            ? `of ${risk.highImpact} high-impact systems`
            : 'no system is flagged HVA or High FIPS'}
        </Typography>
      </Box>

      {risk.highImpact > 0 && risk.belowFloor.length === 0 && (
        <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
          Every high-impact system is at {RISK_TIER_FLOOR} or above.
        </Typography>
      )}

      {listed.length > 0 && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {listed.map((row) => (
            <RiskListRow key={row.system.fismasystemid} row={row} />
          ))}
        </Box>
      )}

      {(hidden > 0 || expanded) && (
        <ShowAllToggle
          hidden={hidden}
          expanded={expanded}
          onToggle={toggle}
          noun={`${risk.belowFloor.length} below ${RISK_TIER_FLOOR}`}
          cappedAtMax={cappedAtMax}
          total={risk.belowFloor.length}
        />
      )}

      {/* Both caveats are about coverage, not posture, so they sit apart from
          the count rather than inflating or deflating it. */}
      <Box sx={{ mt: 'auto', pt: 1 }}>
        {risk.unscored > 0 && (
          <Typography sx={{ fontSize: 11, color: colors.neutral500 }}>
            {risk.unscored} high-impact{' '}
            {risk.unscored === 1 ? 'system has' : 'systems have'} no score to
            judge.
          </Typography>
        )}
        {risk.unknownImpact > 0 && (
          <Typography sx={{ fontSize: 11, color: colors.neutral500 }}>
            {risk.unknownImpact}{' '}
            {risk.unknownImpact === 1 ? 'system has' : 'systems have'} no HVA or
            FIPS designation recorded.
          </Typography>
        )}
        <Typography
          sx={{
            fontSize: 11,
            color: colors.neutral500,
            mt: 0.75,
            pt: 0.75,
            borderTop: `1px solid ${colors.neutral200}`,
          }}
        >
          {targetJudged > 0
            ? `Targets: ${gap.atOrAbove} of ${targetJudged} judged systems at or above their asserted target`
            : 'Targets: none asserted yet'}
          {gap.noTarget > 0 && ` · ${gap.noTarget} with no target set`}
        </Typography>
      </Box>
    </ChartCard>
  )
}
