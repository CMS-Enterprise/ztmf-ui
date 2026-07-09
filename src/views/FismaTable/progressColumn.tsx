import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import type { ScoreProgress } from '@/types'
import { progressTooltip } from './progressHelpers'

/**
 * Cell body for the Data Call Progress column: an updated-count fraction
 * ("12/41") next to an Updated / Not updated chip, wrapped in a tooltip
 * carrying the last-activity time. Pre-populated answers carried over from
 * the previous data call do not count as updated - the fraction reflects
 * genuine edits this cycle (ztmf#299).
 * @param {object} props - Component props.
 * @param {ScoreProgress | undefined} props.entry - The system's progress row;
 *   undefined renders an em-dash (progress fetch failed or not covered).
 * @returns {JSX.Element} The progress cell.
 */
export function ProgressCell({ entry }: { entry: ScoreProgress | undefined }) {
  if (!entry) {
    return <span aria-label="No progress data">—</span>
  }
  const updated = entry.updatedsincestart
  return (
    <Tooltip title={progressTooltip(entry)}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <span>
          {entry.questionsupdated}/{entry.questionsexpected}
        </span>
        <Chip
          size="small"
          label={updated ? 'Updated' : 'Not updated'}
          color={updated ? 'success' : 'warning'}
          variant="outlined"
        />
      </Box>
    </Tooltip>
  )
}
