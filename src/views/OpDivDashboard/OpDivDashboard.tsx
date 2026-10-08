/**
 * Per-OpDiv dashboard: one OpDiv's identity and maturity summary.
 *
 * Every figure on this page is a client-side slice of data the app has already
 * fetched - the OpDiv is a filter, not a request parameter - which is why
 * switching OpDivs costs no network traffic.
 *
 * Deliberately no systems table: the main dashboard already carries the full
 * enumeration, and repeating it here made the page a worse copy of that one.
 * The panels that name systems - the risk list, the not-started worklist, the
 * trend's movers, coverage - link straight to the system or its questionnaire,
 * which is the part a summary page owes its reader.
 *
 * @module views/OpDivDashboard/OpDivDashboard
 */
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import DatacallContextCard from '@/components/DatacallContextCard/DatacallContextCard'
import PageHeader from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useUsers } from '@/utils/users'
import { isAdmin } from '@/utils/userRoles'
import { Routes } from '@/router/constants'
import { useContextProp } from '../Title/Context'
import OpDivSwitcher, {
  ALL_OPDIVS_LABEL,
  OpDivTitle,
} from './components/OpDivSwitcher'
import LoadErrorState from './components/LoadErrorState'
import OpDivHeaderActions from './components/OpDivHeaderActions'
import ScoreHero from '@/components/ScoreSummary/ScoreHero'
import SummaryKpiRow, {
  NOT_STARTED_PANEL_ID,
  RISK_PANEL_ID,
} from '@/components/ScoreSummary/SummaryKpiRow'
import TrendPanel from '@/components/ScoreSummary/TrendPanel'
import RiskPanel from './components/RiskPanel'
import NotStartedPanel from './components/NotStartedPanel'
import CoveragePanel from './components/CoveragePanel'
import {
  PartitionPanel,
  PillarPanel,
  OpDivScorePanel,
  ServiceModelPanel,
  StagePanel,
  SystemScorePanel,
} from './components/DistributionPanels'
import { usersForOpDiv } from './opdivPeople'
import { useOpDivDashboardData } from './useOpDivDashboardData'
import { ALL_OPDIVS, useOpDivScope, writeLastOpDivId } from './useOpDivScope'
import type { FismaSystemType, OpDiv } from '@/types'

/**
 * The OpDiv dashboard page.
 * @returns {JSX.Element} The dashboard, or an explanatory state.
 */
export default function OpDivDashboard() {
  const { opdivId } = useParams<{ opdivId: string }>()
  const { opdiv, visible, isAggregate, status } = useOpDivScope(opdivId)
  const {
    selectedDatacall,
    showDecommissioned,
    setShowDecommissioned,
    fismaSystems,
    fismaSystemsError,
  } = useContextProp()
  // The decommissioned list that was showing when the flag was cleared; held
  // on until the active list replaces it.
  const [staleSystems, setStaleSystems] = useState<FismaSystemType[] | null>(
    null
  )

  // This page describes active posture, and /fismasystems?decommissioned=true
  // SWAPS the list rather than adding to it - so while that flag is on there
  // are no active systems to summarize and every figure here would read zero.
  // The flag is shared layout state, so a user can arrive with it already set
  // from the main dashboard, and this page carries no control to clear it.
  useEffect(() => {
    if (!showDecommissioned) return
    setStaleSystems(fismaSystems)
    setShowDecommissioned(false)
  }, [showDecommissioned, setShowDecommissioned, fismaSystems])
  // A failed refetch leaves the stale list in place; the body reports it.
  const awaitingActiveSystems =
    showDecommissioned || (staleSystems === fismaSystems && !fismaSystemsError)

  // Remember the OpDiv so a later bare /opdivs lands back here. Keyed on the
  // resolved id, so an unresolvable URL is never stored. The aggregate is not
  // remembered: it is not one of the OpDivs the landing picks between.
  useEffect(() => {
    if (opdiv?.active) writeLastOpDivId(opdiv.opdiv_id)
  }, [opdiv])

  if (status === 'loading' || awaitingActiveSystems) {
    return (
      <Box
        sx={{
          height: '60vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress aria-label="Loading OpDiv" />
      </Box>
    )
  }

  if (status === 'error') return <LoadErrorState what="OpDivs" />

  // Explain rather than silently redirect. An OpDiv-scoped admin who reaches
  // an id outside their grants would otherwise see a fully-rendered, entirely
  // zeroed dashboard, which reads as "this OpDiv has no systems".
  if (
    status === 'denied' ||
    status === 'notfound' ||
    (!opdiv && !isAggregate)
  ) {
    const denied = status === 'denied'
    return (
      <Box sx={{ pt: 6, pb: 4 }}>
        <EmptyState
          icon={denied ? <BlockOutlinedIcon /> : <BusinessOutlinedIcon />}
          title={denied ? 'No access to this OpDiv' : 'OpDiv not found'}
          description={
            denied
              ? 'Your account is not assigned to this OpDiv, so its dashboard is not available to you.'
              : 'That OpDiv does not exist, or the link is malformed.'
          }
          tone={denied ? 'warning' : 'neutral'}
          action={
            <Button
              component={RouterLink}
              to={Routes.OPDIVS}
              variant="contained"
              color="primary"
            >
              Go to your OpDivs
            </Button>
          }
        />
      </Box>
    )
  }

  return (
    <OpDivDashboardBody
      opdiv={opdiv}
      isAggregate={isAggregate}
      visibleCount={visible.length}
      switcher={
        <OpDivSwitcher
          opdiv={opdiv}
          visible={visible}
          isAggregate={isAggregate}
        />
      }
      datacallName={selectedDatacall?.datacall}
    />
  )
}

/**
 * The resolved dashboard. Split out so the data hook is only mounted once an
 * OpDiv is known, keeping the hook order stable across the guard states above.
 * @param {object} props - The resolved OpDiv and its chrome.
 * @returns {JSX.Element} The dashboard body.
 */
function OpDivDashboardBody({
  opdiv,
  isAggregate,
  visibleCount,
  switcher,
  datacallName,
}: {
  /** Null in the aggregate view. */
  opdiv: OpDiv | null
  isAggregate: boolean
  visibleCount: number
  switcher: React.ReactNode
  datacallName?: string
}) {
  // Null means "no OpDiv filter", which is the caller's whole server-scoped
  // set rather than a loop over visible ids - see scopeSystemsToOpDiv.
  const opdivId = isAggregate ? null : opdiv?.opdiv_id ?? null
  const { fismaSystemsError, datacallsError, userInfo } = useContextProp()
  const data = useOpDivDashboardData(opdivId)
  const usersQuery = useUsers()

  // In the aggregate every admin the caller can see is relevant, so the
  // roster is not narrowed to one OpDiv's grants.
  const scopedUsers = useMemo(
    () =>
      opdivId === null
        ? usersQuery.data ?? []
        : usersForOpDiv(usersQuery.data ?? [], opdivId),
    [usersQuery.data, opdivId]
  )
  const systems = useMemo(() => data.rows.map((r) => r.system), [data.rows])

  const scopeName = isAggregate
    ? `${visibleCount} OpDivs · ${data.summary.systemCount} systems`
    : opdiv?.name ?? ''
  const subtitle = datacallName
    ? `${scopeName} · Viewing ${datacallName}`
    : scopeName

  // Ordered by dependency: scores mean nothing without the systems and calls.
  const loadError = fismaSystemsError
    ? 'systems'
    : datacallsError
      ? 'data calls'
      : data.isError
        ? 'scores'
        : null

  return (
    <Box sx={{ pt: 3, pb: 4, boxSizing: 'border-box' }}>
      <PageHeader
        title={<OpDivTitle opdiv={opdiv} isAggregate={isAggregate} />}
        subtitle={subtitle}
        breadcrumbs={
          <BreadCrumbs
            segmentLabels={{
              opdivs: 'OpDivs',
              [isAggregate ? ALL_OPDIVS : String(opdivId)]: isAggregate
                ? ALL_OPDIVS_LABEL
                : opdiv?.code ?? '',
            }}
          />
        }
        actions={
          <>
            {switcher}
            <OpDivHeaderActions
              opdiv={opdiv}
              isAggregate={isAggregate}
              systems={systems}
              maps={data.maps}
            />
          </>
        }
      />

      <DatacallContextCard />

      {loadError ? (
        <LoadErrorState what={loadError} />
      ) : data.isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading OpDiv scores" />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'minmax(280px, 1fr) 2fr',
              },
              // Stretch, not start: the card backgrounds meet a common
              // baseline so the row reads as one band instead of leaving a
              // gray step under whichever side is shorter.
              alignItems: 'stretch',
            }}
          >
            <ScoreHero
              avgScore={data.summary.avgScore}
              scoredCount={data.summary.scoredCount}
              systemCount={data.summary.systemCount}
              delta={data.delta}
              priorLabel={data.priorCall?.datacall}
            />
            <SummaryKpiRow
              summary={data.summary}
              completion={data.completion}
              risk={data.risk}
              delta={data.delta}
              priorLabel={data.priorCall?.datacall}
              daysRemaining={data.daysRemaining}
            />
          </Box>

          {/* Columns are grouped by height, not by topic. Score-by-system is
              inherently tall (both ends of a ranking) while the stage donut
              and the six pillar bars are short, so those two share a column
              and roughly match it. Score-by-OpDiv only exists in the
              aggregate, and at 14-16 rows it is tall enough to be its own
              column rather than a third card stacked on the short side -
              which is what left the ranking beside 700px of nothing. */}
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: isAggregate
                  ? 'repeat(3, minmax(0, 1fr))'
                  : 'repeat(2, minmax(0, 1fr))',
              },
              alignItems: 'stretch',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                // Whichever column is shorter still fills the row: the last
                // card in the stack takes up the slack rather than leaving a
                // gray strip beneath it.
                '& > :last-child': { flexGrow: 1 },
              }}
            >
              <StagePanel
                stage={data.breakdowns.stage}
                movement={data.tierMovement}
                priorLabel={data.priorCall?.datacall}
              />
              <PillarPanel
                averages={data.pillars.averages}
                extremes={data.pillars.extremes}
                anchorCall={data.pillars.anchorCall}
                priorLabel={data.priorCall?.datacall}
                isPending={data.pillars.isPending}
              />
            </Box>
            {isAggregate && <OpDivScorePanel rows={data.byOpDiv} />}
            <SystemScorePanel
              bars={data.bySystem}
              unscored={data.summary.unscoredCount}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              alignItems: 'stretch',
            }}
          >
            <PartitionPanel
              eyebrow="FIPS impact"
              breakdown={data.breakdowns.fips}
            />
            <PartitionPanel
              eyebrow="Hosting"
              breakdown={data.breakdowns.hosting}
            />
            <ServiceModelPanel breakdown={data.breakdowns.serviceModel} />
            <PartitionPanel
              eyebrow="Operating model"
              breakdown={data.breakdowns.operatingModel}
            />
          </Box>

          {/* Its own full-width row: a time series reads better with room to
              breathe, and the detail strip under it needs the horizontal
              space for four figures plus every call as text. */}
          <TrendPanel
            points={data.trend.points}
            isPending={data.trend.isPending}
            isError={data.trend.isError}
            cadenceNote={data.trend.cadenceNote}
            selectedCallId={data.trend.selectedCallId}
            onSelectCall={data.trend.selectCall}
            tiers={data.trend.tiers}
            movers={data.trend.movers}
          />

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'repeat(2, minmax(0, 1fr))',
              },
              alignItems: 'stretch',
            }}
          >
            <RiskPanel
              id={RISK_PANEL_ID}
              risk={data.risk}
              gap={data.targetGap}
            />
            <NotStartedPanel
              id={NOT_STARTED_PANEL_ID}
              rows={data.notStarted}
              systemsInCall={data.completion.systemsInCall}
              datacallName={data.pillars.anchorCall?.datacall}
            />
          </Box>

          <CoveragePanel
            scopedUsers={scopedUsers}
            missingIsso={data.coverage.missingIsso}
            missingContact={data.coverage.missingContact}
            opdivId={opdivId}
            opdivCode={isAggregate ? ALL_OPDIVS_LABEL : opdiv?.code ?? ''}
            isPending={usersQuery.isPending}
            isError={usersQuery.isError}
            canManageUsers={isAdmin(userInfo)}
          />
        </Box>
      )}
    </Box>
  )
}
