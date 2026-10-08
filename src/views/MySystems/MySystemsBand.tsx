/**
 * The summary band every tier sees above the systems table on the dashboard.
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
 *  - Below it, collapsed by default, is the score trend.
 *
 * @module views/MySystems/MySystemsBand
 */
import { useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Card from '@/components/ui/Card'
import { useContextProp } from '@/views/Title/Context'
import ScoreHero from '@/components/ScoreSummary/ScoreHero'
import SummaryKpiRow, {
  type KpiJumpTargets,
} from '@/components/ScoreSummary/SummaryKpiRow'
import TrendPanel from '@/components/ScoreSummary/TrendPanel'
import { colors } from '@/theme/tokens'
import { readCollapsed, writeCollapsed } from './collapsePreference'
import { useMySystemsData, type MySystemsData } from './useMySystemsData'

/** How the figures describe their own scope. Never "this OpDiv" - see #747. */
const SCOPE_NOUN = 'your systems'

/** Info-text suffix for the two tiles that filter the systems table. */
const TABLE_JUMP_NOTE =
  'Filters the systems table below to the systems not yet updated.'

/** Props for {@link MySystemsBand}. */
export type MySystemsBandProps = {
  /**
   * Makes the Not started and Answers to confirm tiles filter the systems
   * table; omit when that filter is unavailable, and they stay plain tiles.
   */
  tableJump?: { targetId: string; onJump: (id: string) => void }
}

/**
 * Renders the system-scoped summary band.
 * @param {MySystemsBandProps} props - The optional tile jump into the table.
 * @returns {JSX.Element} The band.
 */
export default function MySystemsBand({ tableJump }: MySystemsBandProps) {
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
      tableJump={tableJump}
    />
  )
}

/**
 * The headline row, the toggle, and - when expanded - the trend.
 *
 * The data hook runs whether or not the detail is open, because the headline
 * row reads from it too. Only the history query is gated on expansion.
 * @param {object} props - Collapse state, handler and the tile jump.
 * @returns {JSX.Element} The band.
 */
function BandContent({
  collapsed,
  onToggle,
  tableJump,
}: {
  collapsed: boolean
  onToggle: () => void
  tableJump?: MySystemsBandProps['tableJump']
}) {
  const data = useMySystemsData(!collapsed)
  const detailId = useId()

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
        <Typography
          component="h2"
          sx={{ fontSize: 15, fontWeight: 600, color: colors.ink }}
        >
          Your systems at a glance
        </Typography>
        <Button
          size="small"
          onClick={onToggle}
          endIcon={collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          aria-expanded={!collapsed}
          aria-controls={detailId}
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
          <HeadlineRow data={data} tableJump={tableJump} />
          <Box
            id={detailId}
            sx={{
              display: collapsed ? 'none' : 'flex',
              flexDirection: 'column',
            }}
          >
            {/* TrendPanel explains itself when there are under two points. */}
            {!collapsed && (
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
          </Box>
        </Box>
      )}
    </Box>
  )
}

/**
 * The always-visible headline: overall score beside the KPI tiles.
 * @param {object} props - The band's data and the optional table jump.
 * @returns {JSX.Element} The headline row.
 */
function HeadlineRow({
  data,
  tableJump,
}: {
  data: MySystemsData
  tableJump?: MySystemsBandProps['tableJump']
}) {
  const jumpTargets: KpiJumpTargets = tableJump
    ? { notStarted: tableJump.targetId, toConfirm: tableJump.targetId }
    : {}

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        alignItems: 'stretch',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1fr) 2fr' },
      }}
    >
      <ScoreHero
        avgScore={data.summary.avgScore}
        scoredCount={data.summary.scoredCount}
        systemCount={data.summary.systemCount}
        delta={data.delta}
        priorLabel={data.priorCall?.datacall}
        scopeNoun={SCOPE_NOUN}
      />
      <SummaryKpiRow
        summary={data.summary}
        completion={data.completion}
        risk={data.risk}
        delta={data.delta}
        priorLabel={data.priorCall?.datacall}
        daysRemaining={data.daysRemaining}
        scopeNoun={SCOPE_NOUN}
        jumpTargets={jumpTargets}
        onJump={tableJump?.onJump}
        jumpNote={TABLE_JUMP_NOTE}
      />
    </Box>
  )
}
