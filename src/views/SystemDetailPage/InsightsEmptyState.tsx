import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EmptyState from '@/components/ds/EmptyState'

/**
 * Empty state used by the ZTMF Insights section on the System detail page,
 * both when sdl_sync is not configured for the system and when the upstream
 * enrichment endpoint returns no record. Kept here so CfactsRecordCard and
 * SystemDetailReadView can share it without circular imports.
 * @returns {JSX.Element} The insights empty state.
 */
export default function InsightsEmptyState() {
  return (
    <EmptyState
      icon={<AutoAwesomeIcon sx={{ fontSize: 22 }} />}
      title="No ZTMF insights yet"
      description="Insights appear once a datacall closes and the system has at least two prior responses for trend comparison."
      tone="info"
    />
  )
}
