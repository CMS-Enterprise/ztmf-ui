import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { FismaSystemType } from '@/types'

/** Props for {@link DecommissionedSystemInfo}. */
export interface DecommissionedSystemInfoProps {
  /** The system being viewed; rendered only when decommissioned. */
  system: FismaSystemType
  /** Resolved fullname for system.decommissioned_by; falls back to the
   *  raw userid when the lookup has not resolved yet. */
  decommissionedByName: string
  /** Resolved fullname for system.reactivated_by; same fallback. */
  reactivatedByName: string
  /** Open the decommission form pre-filled from the existing values. */
  onEditDecommission: () => void
  /** Clear reactivation notes and open the reactivate form. */
  onReactivate: () => void
}

/**
 * Read-only details panel rendered above the decommission / reactivate
 * actions for a decommissioned system: shows the date, the actor's name
 * (with a userid fallback), the saved notes, an optional "previously
 * reactivated" line, plus the two action buttons.
 *
 * The action buttons are wired through callbacks so the parent owns the
 * pre-fill logic (it knows about the decommission form's date / notes
 * state and the reactivate form's notes state).
 * @param {DecommissionedSystemInfoProps} props - System + resolved names
 *   + action callbacks.
 * @returns {JSX.Element} The details + actions panel.
 */
export default function DecommissionedSystemInfo({
  system,
  decommissionedByName,
  reactivatedByName,
  onEditDecommission,
  onReactivate,
}: DecommissionedSystemInfoProps) {
  return (
    <>
      {system?.decommissioned_date && (
        <Typography
          variant="caption"
          sx={{ display: 'block', ml: 2, color: 'text.secondary' }}
        >
          Date: {new Date(system.decommissioned_date).toLocaleDateString()}
        </Typography>
      )}
      {system?.decommissioned_by && (
        <Typography
          variant="caption"
          sx={{ display: 'block', ml: 2, color: 'text.secondary' }}
        >
          By: {decommissionedByName || system.decommissioned_by}
        </Typography>
      )}
      {system?.decommissioned_notes && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            ml: 2,
            mt: 0.5,
            color: 'text.secondary',
          }}
        >
          Notes: {system.decommissioned_notes}
        </Typography>
      )}
      {system?.reactivated_date && (
        <Box sx={{ mt: 1 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontStyle: 'italic',
              color: 'text.secondary',
            }}
          >
            Previously reactivated on{' '}
            {new Date(system.reactivated_date).toLocaleDateString()}
            {system?.reactivated_by &&
              ` by ${reactivatedByName || system.reactivated_by}`}
            {system?.reactivation_notes
              ? ` (notes: ${system.reactivation_notes})`
              : ''}
          </Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={onEditDecommission}
        >
          Edit Decommission Details
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={onReactivate}
        >
          Reactivate System
        </Button>
      </Box>
    </>
  )
}
