import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, CircularProgress } from '@mui/material'
import PageHeader from '@/components/ds/PageHeader'
import { CodeBadge } from '@/components/ds/StatusChip'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
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
  const navigate = useNavigate()
  const { fismaSystems, selectedDatacall, latestDataCallId } = useContextProp()
  const activeDataCallId = selectedDatacall?.datacallid ?? latestDataCallId
  const systemId = Number(fismasystemid)
  const system = fismaSystems.find((s) => s.fismasystemid === systemId)

  const [scores, setScores] = useState<ScoreAggregate[]>([])
  const [loading, setLoading] = useState<boolean>(true)

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

  return (
    <Box sx={{ py: 4 }}>
      <PageHeader
        title="Pillar scores"
        subtitle={
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          >
            {systemName}
            {systemAcronym && <CodeBadge code={systemAcronym} />}
          </Box>
        }
        breadcrumbs={<BreadCrumbs segmentLabels={{ [systemId]: systemName }} />}
        actions={
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`/systems/${systemId}`)}
          >
            Back to system
          </Button>
        }
      />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            backgroundColor: '#fff',
            border: '1px solid #E5E8EE',
            borderRadius: 2.5,
            p: 4,
          }}
        >
          <PillarScoresContent
            scores={scores}
            selectedDataCallId={activeDataCallId}
          />
        </Box>
      )}
    </Box>
  )
}
