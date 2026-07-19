import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Button, CircularProgress } from '@mui/material'
import PageHeader from '@/components/ui/PageHeader'
import DatacallContextCard from '@/components/DatacallContextCard/DatacallContextCard'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import ScoreDiffModal from '@/components/ScoreDiffModal/ScoreDiffModal'
import PillarScoresContent from './PillarScoresContent'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { isAuthHandled } from '@/utils/notify'
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
    setSelectedDatacall,
    latestDataCallId,
    datacalls,
  } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const systemId = Number(fismasystemid)
  const system = fismaSystems.find((s) => s.fismasystemid === systemId)

  const [scores, setScores] = useState<ScoreAggregate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [compareOpen, setCompareOpen] = useState<boolean>(false)
  // Comparison baseline selected by the user in the Compare Datacalls modal.
  // When null we fall back to "most recent prior datacall on this system"
  // (the default the modal seeds and the page used to hard-wire).
  const [comparisonFromId, setComparisonFromId] = useState<number | null>(null)

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
  const currentDatacallName = datacalls.find(
    (dc) => dc.datacallid === activeDataCallId
  )?.datacall
  // Previous-datacall lookup: prefer the user's explicit pick from the modal;
  // fall back to the most recent prior datacall this system has scores for.
  const fallbackPreviousId = scores
    .filter((s) => s.datacallid < (activeDataCallId ?? Number.MAX_SAFE_INTEGER))
    .sort((a, b) => b.datacallid - a.datacallid)[0]?.datacallid
  const previousDatacallId = comparisonFromId ?? fallbackPreviousId
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
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setCompareOpen(true)}
            disabled={scores.length < 2}
          >
            Compare datacalls
          </Button>
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
          comparisonFromDatacallId={previousDatacallId}
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
        onComparisonChange={(from, to) => {
          // From -> page-level comparison baseline (trend line, radar
          // Previous series, per-pillar deltas).
          setComparisonFromId(from?.datacallid ?? null)
          // To -> the app-wide selectedDatacall. Picking a different "To"
          // in the modal flows back into the DatacallContextCard's picker,
          // the hero "Overall ZT score", the pillar grid, and every other
          // datacall-scoped surface in the app. One source of truth.
          if (to && to.datacallid !== selectedDatacall?.datacallid) {
            setSelectedDatacall(to)
          }
        }}
      />
    </Box>
  )
}
