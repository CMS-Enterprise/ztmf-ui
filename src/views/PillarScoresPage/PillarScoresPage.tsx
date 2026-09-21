import { useEffect, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Box, Button, CircularProgress } from '@mui/material'
import PageHeader from '@/components/ui/PageHeader'
import DatacallContextCard from '@/components/DatacallContextCard/DatacallContextCard'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import ScoreDiffModal from '@/components/ScoreDiffModal/ScoreDiffModal'
import PillarScoresContent from './PillarScoresContent'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { isAuthHandled } from '@/utils/notify'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import { RouteNames } from '@/router/constants'
import { encodeDatacallSlug } from '@/views/QuestionnairePage/deepLink'
import { hasSystemAccess } from '@/utils/userRoles'
import type { ScoreAggregate } from '@/types'

/**
 * Dedicated pillar-scores page at /systems/:fismasystemid/pillar-scores.
 *
 * Promoted out of the old dense modal so the breakdown gets a real URL,
 * back-button support and room to breathe. Fetches the same aggregate the
 * modal used (include_pillars=true) and renders the shared content block.
 * @returns {JSX.Element} The pillar-scores page.
 */
export default function PillarScoresPage() {
  const { fismasystemid } = useParams()
  const {
    fismaSystems,
    selectedDatacall,
    latestDataCallId,
    datacalls,
    userInfo,
  } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const systemId = Number(fismasystemid)
  const system = fismaSystems.find((s) => s.fismasystemid === systemId)

  const [scores, setScores] = useState<ScoreAggregate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [compareOpen, setCompareOpen] = useState<boolean>(false)

  useEffect(() => {
    if (!systemId) return
    const controller = new AbortController()
    async function fetchScores() {
      try {
        const res = await axiosInstance.get(
          `/scores/aggregate?fismasystemid=${systemId}&include_pillars=true`,
          { signal: controller.signal }
        )
        setScores(res.data.data ?? [])
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Error fetching pillar scores:', error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchScores()
    return () => {
      controller.abort()
    }
  }, [systemId])

  const systemName = system?.fismaname ?? 'System'
  const systemAcronym = system?.fismaacronym ?? ''
  // Subtitle stays system-name-only because the datacall card above carries
  // the current-datacall context. currentDatacallName is still threaded down
  // for the hero "Datacall" stat (a useful tier-level confirmation inside
  // the score card) and previousDatacallName for the trend line.
  const currentDatacall = datacalls.find(
    (dc) => dc.datacallid === activeDataCallId
  )
  const currentDatacallName = currentDatacall?.datacall
  // Previous-datacall lookup: prefer the user's explicit pick from the modal;
  // fall back to the next-older call (by deadline, not datacallid - historical
  // loads can out-id the real current call, #393) this system has scores for.
  const scoredCallsByDeadline = sortDatacallsByDeadline(
    datacalls.filter((dc) => scores.some((s) => s.datacallid === dc.datacallid))
  )
  const activeScoredIdx = scoredCallsByDeadline.findIndex(
    (dc) => dc.datacallid === activeDataCallId
  )
  const fallbackPreviousId =
    activeScoredIdx >= 0
      ? scoredCallsByDeadline[activeScoredIdx + 1]?.datacallid
      : // Active call has no scores for this system: the newest scored call
        // stands in as "current", so the one after it is the fallback.
        scoredCallsByDeadline[1]?.datacallid
  const previousDatacallId = fallbackPreviousId
  const previousDatacallName = datacalls.find(
    (dc) => dc.datacallid === previousDatacallId
  )?.datacall
  const subtitle = systemName

  return (
    <Box sx={{ py: 4 }}>
      <PageHeader
        title="Pillar scores"
        subtitle={subtitle}
        breadcrumbs={<BreadCrumbs segmentLabels={{ [systemId]: systemName }} />}
        actions={
          <>
            {hasSystemAccess(userInfo) && system && (
              <Button
                component={RouterLink}
                to={`/systems/${systemId}`}
                variant="outlined"
                color="primary"
                sx={{
                  '&:link, &:visited': { color: 'primary.main' },
                }}
              >
                System Info
              </Button>
            )}
            <Button
              component={RouterLink}
              to={`/${RouteNames.QUESTIONNAIRE}/${systemAcronym.toLowerCase()}/${encodeDatacallSlug(currentDatacall?.datacall ?? '')}`}
              state={{
                fismasystemid: systemId,
                datacallid: currentDatacall?.datacallid,
                datacall: currentDatacall?.datacall,
                deadline: currentDatacall?.deadline,
              }}
              variant="outlined"
              color="primary"
              disabled={!system || !currentDatacall}
              sx={{
                '&:link, &:visited': { color: 'primary.main' },
              }}
            >
              Questionnaire
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setCompareOpen(true)}
              disabled={scores.length < 2}
            >
              Compare datacalls
            </Button>
          </>
        }
      />
      <DatacallContextCard />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <PillarScoresContent
          scores={scores}
          selectedDataCallId={activeDataCallId ?? 0}
          fismasystemid={systemId}
          currentDatacallName={currentDatacallName}
          previousDatacallName={previousDatacallName}
          datacalls={datacalls}
        />
      )}
      <ScoreDiffModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        fismasystemid={systemId}
        systemName={systemName}
        systemAcronym={systemAcronym}
        selectedDataCallId={activeDataCallId}
      />
    </Box>
  )
}
