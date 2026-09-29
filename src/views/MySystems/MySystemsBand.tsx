/**
 * The summary band an ISSO, ISSM or System Delegate sees on the dashboard.
 *
 * Home's stat tiles describe an estate: highest score, lowest score, how many
 * sit at Optimal. Across three systems those name two of the three and answer
 * nothing. This band answers the question a system-scoped user actually has -
 * what needs my action.
 *
 * Two tiers, deliberately:
 *
 *  - The headline row - overall score and the eight KPI tiles - is ALWAYS
 *    visible. It is the part that earns its space at any size, and it is small
 *    enough to leave the systems table within reach.
 *  - Everything below it is detail, collapsed by default. Left open, nine
 *    cards pushed the table most of a screen down, and with a young dataset
 *    most of them had nothing to say.
 *
 * Panels with nothing to report at all are dropped rather than rendered empty;
 * panels reporting an all-clear are kept, because "every system has progress"
 * is an answer, not an absence. See hasNothingToSay call sites.
 *
 * @module views/MySystems/MySystemsBand
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Card from '@/components/ui/Card'
import { useContextProp } from '@/views/Title/Context'
import OpDivHero from '@/views/OpDivDashboard/components/OpDivHero'
import OpDivKpiRow from '@/views/OpDivDashboard/components/OpDivKpiRow'
import NotStartedPanel from '@/views/OpDivDashboard/components/NotStartedPanel'
import TrendPanel from '@/views/OpDivDashboard/components/TrendPanel'
import {
  PillarPanel,
  SystemScorePanel,
} from '@/views/OpDivDashboard/components/DistributionPanels'
import { colors } from '@/theme/tokens'
import CompletionPanel from './components/CompletionPanel'
import MovementPanel from './components/MovementPanel'
import TargetPanel from './components/TargetPanel'
import WeakestPillarPanel from './components/WeakestPillarPanel'
import { readCollapsed, writeCollapsed } from './collapsePreference'
import { useMySystemsData, type MySystemsData } from './useMySystemsData'

/** How the figures describe their own scope. Never "this OpDiv" - see #747. */
const SCOPE_NOUN = 'your systems'

/** Props for {@link MySystemsBand}. */
export type MySystemsBandProps = {
  /**
   * Withholds the target-maturity worklist. A System Delegate is answers-only
   * and cannot set a target, so offering them that backlog is offering a 403.
   */
  hideTargets?: boolean
}

/**
 * Renders the system-scoped summary band.
 * @param {MySystemsBandProps} props - Whether to withhold the target panel.
 * @returns {JSX.Element} The band.
 */
export default function MySystemsBand({
  hideTargets = false,
}: MySystemsBandProps) {
  const { showDecommissioned } = useContextProp()
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(next)
  }

  // GET /fismasystems?decommissioned=true SWAPS the list rather than adding to
  // it, so while that flag is on the client holds decommissioned systems only
  // and every figure here would read zero beside a table full of rows. The
  // dashboard cannot force the flag off the way the OpDiv page does - admins
  // use it deliberately - so the band says why it is standing down instead.
  if (showDecommissioned) {
    return (
      <Card sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
          Showing decommissioned systems. The summary above the table describes
          active systems, so it is hidden while this view is on.
        </Typography>
      </Card>
    )
  }

  return (
    <BandContent
      collapsed={collapsed}
      onToggle={toggle}
      hideTargets={hideTargets}
    />
  )
}

/**
 * The headline row, the toggle, and - when expanded - the detail.
 *
 * The data hook runs whether or not the detail is open, because the headline
 * row reads from it too. Only the extra pillar and history queries are gated,
 * inside useMySystemsData.
 * @param {object} props - Collapse state, handler and the delegate carve-out.
 * @returns {JSX.Element} The band.
 */
function BandContent({
  collapsed,
  onToggle,
  hideTargets,
}: {
  collapsed: boolean
  onToggle: () => void
  hideTargets: boolean
}) {
  const data = useMySystemsData(!collapsed)

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.5,
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: colors.ink }}>
          Your systems at a glance
        </Typography>
        <Button
          size="small"
          onClick={onToggle}
          endIcon={collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          aria-expanded={!collapsed}
          sx={{ fontSize: 13, textTransform: 'none' }}
        >
          {collapsed ? 'Show detail' : 'Hide detail'}
        </Button>
      </Box>

      {data.isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Loading your systems summary" />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <HeadlineRow data={data} />
          {!collapsed && <DetailPanels data={data} hideTargets={hideTargets} />}
        </Box>
      )}
    </Box>
  )
}

/**
 * The always-visible headline: overall score beside the KPI tiles.
 * @param {object} props - The band's data.
 * @returns {JSX.Element} The headline row.
 */
function HeadlineRow({ data }: { data: MySystemsData }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        alignItems: 'stretch',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1fr) 2fr' },
      }}
    >
      <OpDivHero
        avgScore={data.summary.avgScore}
        scoredCount={data.summary.scoredCount}
        systemCount={data.summary.systemCount}
        delta={data.delta}
        priorLabel={data.priorCall?.datacall}
        scopeNoun={SCOPE_NOUN}
      />
      <OpDivKpiRow
        summary={data.summary}
        completion={data.completion}
        risk={data.risk}
        delta={data.delta}
        priorLabel={data.priorCall?.datacall}
        daysRemaining={data.daysRemaining}
        scopeNoun={SCOPE_NOUN}
      />
    </Box>
  )
}

/**
 * The collapsible detail, with silent panels dropped.
 *
 * Each panel decides whether it has anything to report. A panel holding an
 * all-clear stays - "every system has a target" is worth saying - but one with
 * no underlying data at all is noise, and nine such cards is what made the
 * expanded band unreadable against a young dataset.
 * @param {object} props - The band's data and the delegate carve-out.
 * @returns {JSX.Element} The detail panels.
 */
function DetailPanels({
  data,
  hideTargets,
}: {
  data: MySystemsData
  hideTargets: boolean
}) {
  const priorLabel = data.priorCall?.datacall

  // An all-clear is a real answer; an absence is not. Completion and
  // not-started speak whenever the call expects anything at all, so they are
  // gated on enrollment rather than on having rows to list.
  const enrolled = data.completion.systemsInCall > 0
  const worklists = [
    enrolled && <CompletionPanel key="completion" rows={data.completionRows} />,
    enrolled && (
      <NotStartedPanel
        key="notstarted"
        rows={data.notStarted}
        systemsInCall={data.completion.systemsInCall}
        datacallId={data.pillars.anchorCall?.datacallid}
      />
    ),
    // Movement needs a baseline call to compare against; without one it has
    // nothing to say that the hero's "no prior call" note does not.
    priorLabel && data.movement.length > 0 && (
      <MovementPanel
        key="movement"
        rows={data.movement}
        priorLabel={priorLabel}
      />
    ),
    data.weakestPillars.length > 0 && (
      <WeakestPillarPanel
        key="weakest"
        rows={data.weakestPillars}
        callName={data.pillars.anchorCall?.datacall}
      />
    ),
    !hideTargets && data.summary.systemCount > 0 && (
      <TargetPanel
        key="target"
        rows={data.noTarget}
        totalSystems={data.summary.systemCount}
      />
    ),
  ].filter(Boolean)

  const distributions = [
    data.pillars.averages.length > 0 && (
      <PillarPanel
        key="pillars"
        averages={data.pillars.averages}
        extremes={data.pillars.extremes}
        anchorCall={data.pillars.anchorCall}
        priorLabel={priorLabel}
        isPending={data.pillars.isPending}
      />
    ),
    data.bySystem.length > 0 && (
      <SystemScorePanel
        key="bysystem"
        bars={data.bySystem}
        unscored={data.summary.unscoredCount}
        scopeNoun={SCOPE_NOUN}
      />
    ),
  ].filter(Boolean)

  // Two points is the minimum a line can join; below that TrendPanel renders
  // its own explanation, which is an absence rather than an answer.
  const showTrend = data.trend.points.length >= 2

  if (worklists.length === 0 && distributions.length === 0 && !showTrend) {
    return (
      <Card>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          Nothing to report yet. Once your systems are enrolled in a data call
          and scored, their progress and pillar detail appear here.
        </Typography>
      </Card>
    )
  }

  const gridSx = {
    display: 'grid',
    gap: 1.5,
    alignItems: 'stretch',
    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
  } as const

  return (
    <>
      {worklists.length > 0 && <Box sx={gridSx}>{worklists}</Box>}
      {distributions.length > 0 && <Box sx={gridSx}>{distributions}</Box>}
      {showTrend && (
        <TrendPanel
          points={data.trend.points}
          isPending={data.trend.isPending}
          isError={data.trend.isError}
          cadenceNote={data.trend.cadenceNote}
          selectedCallId={data.trend.selectedCallId}
          onSelectCall={data.trend.selectCall}
          tiers={data.trend.tiers}
          movers={data.trend.movers}
          scopeNoun={SCOPE_NOUN}
        />
      )}
    </>
  )
}
