/**
 * The OpDiv's average score across data calls.
 *
 * The one genuine plot on this page - a value over time is the case a line
 * chart exists for. Everything else here is a labeled bar list, because the
 * tier palette is not safe as adjacent fills (see BarList).
 *
 * Clicking a point selects it, and the detail below describes that call: its
 * average, its movement, how its systems were spread across the tiers, and
 * which systems produced the step into it. All of that comes out of the score
 * history already in hand, so opening a point costs nothing.
 *
 * Deliberately NOT a pillar breakdown: the Average-by-pillar card above already
 * carries that, and on the default selection the two were the same six numbers.
 * Spread and movers are the questions a point on a line actually raises.
 *
 * @module components/ScoreSummary/TrendPanel
 */
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Eyebrow from '@/components/ui/Eyebrow'
import Stat from '@/components/ui/Stat'
import { colors, fonts } from '@/theme/tokens'
import { tierForScore } from '@/utils/tierStyles'
import BarList from './BarList'
import ChartCard from './ChartCard'
import { stageColor } from './stageColor'
import {
  summarizeTrend,
  type Movers,
  type ScoreMover,
  type TierCount,
  type TrendPoint,
} from '@/views/OpDivDashboard/opdivTrend'

/** The user-facing score scale. */
const MIN_SCORE = 1
const MAX_SCORE = 5
/** Points beyond this get a range brush; below it the whole series fits. */
const BRUSH_THRESHOLD = 6

/** Explains the figure in the card header. */
const TREND_INFO =
  'Average score across data calls, over systems active today. CMS runs quarterly calls while other OpDivs run an annual ZTM cycle; the two are not comparable, so each series follows its own cadence and they meet only at the shared FY26 cycle. Click a point to see how that call was spread across the tiers and which systems moved into it.'

/** Props for {@link TrendPanel}. */
export type TrendPanelProps = {
  points: TrendPoint[]
  isPending: boolean
  isError: boolean
  /** Names the cadence this series follows, e.g. "Annual ZTM calls". */
  cadenceNote?: string
  /** The call the detail below the chart describes. */
  selectedCallId: number | null
  onSelectCall: (datacallId: number) => void
  /** How the selected call's systems were spread across tiers. */
  tiers: TierCount[]
  /** The systems behind the step into the selected call. */
  movers: Movers
  /**
   * What the series covers, for the empty state and the chart's description.
   * Reused by the system-scoped dashboard, where "this OpDiv" is wrong.
   */
  scopeNoun?: string
}

/**
 * One system's score change, named and linked.
 * @param {{ mover: ScoreMover }} props - The mover.
 * @returns {JSX.Element} The row.
 */
function MoverRow({ mover }: { mover: ScoreMover }) {
  const up = mover.delta > 0
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 1,
        py: 0.3,
      }}
    >
      <Link
        component={RouterLink}
        to={`/systems/${mover.fismasystemid}`}
        underline="hover"
        sx={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {mover.acronym}
      </Link>
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexShrink: 0 }}
      >
        <Typography sx={{ fontSize: 11, color: colors.neutral500 }}>
          {mover.from.toFixed(2)} → {mover.to.toFixed(2)}
        </Typography>
        {/* The sign is spelled out, not only colored. */}
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: up ? colors.up : colors.down,
            minWidth: 44,
            textAlign: 'right',
          }}
        >
          {up ? '+' : ''}
          {mover.delta.toFixed(2)}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * Renders the score-over-time line and the selected call's detail.
 * @param {TrendPanelProps} props - Series, selection and pillar breakdown.
 * @returns {JSX.Element} The trend card.
 */
export default function TrendPanel({
  points,
  isPending,
  isError,
  cadenceNote,
  selectedCallId,
  onSelectCall,
  tiers,
  movers,
  scopeNoun = 'this OpDiv',
}: TrendPanelProps) {
  // Stated, not hidden: systems are attributed to an OpDiv from the active
  // systems list, so a system decommissioned mid-history leaves every earlier
  // point. Presenting that as a clean trend would be survivorship bias.
  const subtitle = ['Active systems only, scored in each call', cadenceNote]
    .filter(Boolean)
    .join(' · ')

  if (isPending) {
    return (
      <ChartCard eyebrow="Score trend" subtitle={subtitle} info={TREND_INFO}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} aria-label="Loading score trend" />
        </Box>
      </ChartCard>
    )
  }

  if (isError) {
    return (
      <ChartCard eyebrow="Score trend" subtitle={subtitle} info={TREND_INFO}>
        <Typography sx={{ fontSize: 13, color: colors.neutral500, py: 2 }}>
          The score history could not be loaded. Every other figure on this page
          is unaffected.
        </Typography>
      </ChartCard>
    )
  }

  if (points.length < 2) {
    return (
      <ChartCard eyebrow="Score trend" subtitle={subtitle} info={TREND_INFO}>
        <Typography sx={{ fontSize: 13, color: colors.neutral500, py: 2 }}>
          {points.length === 0
            ? `No scored data calls yet for ${scopeNoun}.`
            : 'Only one scored data call so far, so there is no trend to plot yet.'}
        </Typography>
      </ChartCard>
    )
  }

  const summary = summarizeTrend(points)
  // Always resolves to a real point, so the detail is never blank and never
  // describes a call that is not plotted.
  const foundIndex = points.findIndex((p) => p.datacallid === selectedCallId)
  const activeIndex = foundIndex >= 0 ? foundIndex : points.length - 1
  const active = points[activeIndex]
  const previous = activeIndex > 0 ? points[activeIndex - 1] : null
  const step =
    active.avg !== null && previous?.avg != null
      ? active.avg - previous.avg
      : null
  // Tiered systems, not the point's own n: a system can carry a tier without a
  // score, so the shares have to divide by what is actually in the mix.
  const tieredTotal = tiers.reduce((sum, t) => sum + t.count, 0)

  const stepTo = (idx: number) => {
    const next = points[idx]
    if (next) onSelectCall(next.datacallid)
  }

  return (
    <ChartCard eyebrow="Score trend" subtitle={subtitle} info={TREND_INFO}>
      {/* Every plotted point as text; the chart stays its own recharts keyboard widget. */}
      <Box component="table" sx={visuallyHidden}>
        <caption>
          {`Average Zero Trust score for ${scopeNoun} across ${points.length} data calls, from ${points[0].label} to ${points[points.length - 1].label}`}
        </caption>
        <thead>
          <tr>
            <th scope="col">Data call</th>
            <th scope="col">Average score</th>
            <th scope="col">Systems scored</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.datacallid}>
              <th scope="row">{p.label}</th>
              <td>{p.avg !== null ? p.avg.toFixed(2) : 'No score'}</td>
              <td>{p.n}</td>
            </tr>
          ))}
        </tbody>
      </Box>
      <Box
        sx={{
          width: '100%',
          height: points.length > BRUSH_THRESHOLD ? 260 : 220,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 16, bottom: 4, left: -18 }}
            onClick={(state) => {
              const idx = state?.activeTooltipIndex
              if (typeof idx === 'number') stepTo(idx)
            }}
            style={{ cursor: 'pointer' }}
            title="Score trend chart. The values are in the table before it."
          >
            <CartesianGrid
              stroke={colors.neutral200}
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: colors.neutral500 }}
              tickLine={false}
              axisLine={{ stroke: colors.neutral200 }}
            />
            <YAxis
              domain={[MIN_SCORE, MAX_SCORE]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{
                fontSize: 11,
                fill: colors.neutral500,
                fontFamily: fonts.mono,
              }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number, _name, item) => [
                `${value.toFixed(2)} (${(item?.payload as TrendPoint)?.n ?? 0} systems)`,
                'Average score',
              ]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: `1px solid ${colors.neutral200}`,
              }}
            />
            {/* Single series, so no legend box - the card title names it. */}
            <Line
              type="monotone"
              dataKey="avg"
              stroke={colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{
                r: 4,
                fill: colors.primary,
                stroke: colors.white,
                strokeWidth: 2,
              }}
              activeDot={{ r: 6 }}
            />
            {/* Ring on the selected point, so the detail below has an anchor. */}
            {active.avg !== null && (
              <ReferenceDot
                x={active.label}
                y={active.avg}
                r={7}
                fill={colors.primary}
                stroke={colors.white}
                strokeWidth={2}
              />
            )}
            {points.length > BRUSH_THRESHOLD && (
              <Brush
                dataKey="label"
                height={24}
                travellerWidth={8}
                stroke={colors.neutral500}
                fill={colors.neutral50}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* The selected call's figures. The arrows are what makes the series
          reachable without a pointer - recharts marks are not focusable. */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          alignItems: 'flex-start',
          pt: 1.5,
          mt: 0.5,
          borderTop: `1px solid ${colors.neutral200}`,
        }}
      >
        {/* Announces each step; the visible readout is too scattered to be one live region. */}
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={visuallyHidden}
        >
          {`${active.label}: average ${
            active.avg !== null ? active.avg.toFixed(2) : 'not scored'
          }, ${active.n} ${active.n === 1 ? 'system' : 'systems'} scored`}
        </Box>
        <Box sx={{ minWidth: 190 }}>
          <Eyebrow>Data call</Eyebrow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <IconButton
              size="small"
              aria-label="Previous data call"
              disabled={activeIndex === 0}
              onClick={() => stepTo(activeIndex - 1)}
              sx={{ p: 0.25 }}
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography
              sx={{ fontSize: 16, fontWeight: 700, color: colors.ink }}
            >
              {active.label}
            </Typography>
            <IconButton
              size="small"
              aria-label="Next data call"
              disabled={activeIndex === points.length - 1}
              onClick={() => stepTo(activeIndex + 1)}
              sx={{ p: 0.25 }}
            >
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
        <Stat
          label="Average"
          value={active.avg !== null ? active.avg.toFixed(2) : '—'}
          hint={active.avg !== null ? tierForScore(active.avg) : undefined}
        />
        <Stat label="Systems" value={active.n} hint="scored in this call" />
        <Stat
          label="Vs previous"
          value={
            step === null ? '—' : `${step > 0 ? '+' : ''}${step.toFixed(2)}`
          }
          hint={previous ? previous.label : 'first in series'}
        />
        {summary.net !== null && summary.first && summary.latest && (
          <Stat
            label="Net"
            value={`${summary.net > 0 ? '+' : ''}${summary.net.toFixed(2)}`}
            hint={`${summary.first.label} → ${summary.latest.label}`}
          />
        )}
      </Box>

      {/* What the average hides, and what produced it. Both read off the
          history already fetched for the line itself. */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          mt: 1.5,
        }}
      >
        <Box>
          <Eyebrow sx={{ mb: 0.5 }}>Tier mix in {active.label}</Eyebrow>
          <BarList
            items={tiers.map((t) => ({
              label: t.tier,
              value: t.count,
              color: stageColor(t.tier),
              note:
                tieredTotal > 0
                  ? `${Math.round((t.count / tieredTotal) * 100)}%`
                  : undefined,
            }))}
            max={tieredTotal}
            labelWidth={92}
            emptyMessage="No tiers recorded for this call."
          />
        </Box>

        <Box>
          <Eyebrow sx={{ mb: 0.5 }}>
            {previous
              ? `Biggest movers vs ${previous.label}`
              : 'Biggest movers'}
          </Eyebrow>
          {!previous ? (
            <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
              First call in the series, so there is nothing to compare against.
            </Typography>
          ) : movers.gained.length === 0 && movers.lost.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
              {movers.paired === 0
                ? 'No system was scored in both calls, so no movement can be attributed.'
                : `No system's score changed across ${movers.paired} scored in both calls.`}
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {movers.gained.map((m) => (
                <MoverRow key={m.fismasystemid} mover={m} />
              ))}
              {movers.lost.map((m) => (
                <MoverRow key={m.fismasystemid} mover={m} />
              ))}
            </Box>
          )}
          {/* The denominator, so a three-row list is never read as the whole
              population moving. */}
          {previous && movers.paired > 0 && (
            <Typography
              sx={{ fontSize: 11, color: colors.neutral500, mt: 0.5 }}
            >
              {movers.paired - movers.unchanged} of {movers.paired} systems
              scored in both calls changed.
            </Typography>
          )}
        </Box>
      </Box>

      {/* Sighted twin of the hidden table, so hidden from assistive tech. */}
      <Typography
        aria-hidden="true"
        sx={{ mt: 1.5, fontSize: 11, color: colors.neutral500 }}
      >
        {points
          .map((p) => `${p.label} ${p.avg !== null ? p.avg.toFixed(2) : '—'}`)
          .join(' · ')}
      </Typography>
    </ChartCard>
  )
}
