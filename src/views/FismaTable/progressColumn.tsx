import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import type { ScoreProgress } from '@/types'
import { hasNoQuestionnaire, progressTooltip } from './progressHelpers'

/**
 * Cell body for the Data Call Progress column: an updated-count fraction
 * ("12/41") next to a status chip, wrapped in a tooltip carrying the
 * last-activity time. Pre-populated answers carried over from the previous
 * data call do not count as updated - the fraction reflects genuine edits
 * this cycle (ztmf#299).
 *
 * Three states:
 *   - a system with no applicable questionnaire (0/0) renders a neutral
 *     "N/A" chip, not an orange "Not updated" one - it is not a laggard,
 *     there is nothing to nudge;
 *   - a system with any genuine edit reads "Updated" (green);
 *   - otherwise "Not updated" (orange). The chip is derived from
 *     questionsupdated so it can never disagree with the fraction.
 * @param {object} props - Component props.
 * @param {ScoreProgress | undefined} props.entry - The system's progress row;
 *   undefined renders an em-dash (progress fetch failed or not covered).
 * @returns {JSX.Element} The progress cell.
 */
export function ProgressCell({ entry }: { entry: ScoreProgress | undefined }) {
  if (!entry) {
    return <span aria-label="No progress data">—</span>
  }
  if (hasNoQuestionnaire(entry)) {
    return (
      <Tooltip title={progressTooltip(entry)}>
        <Chip size="small" label="N/A" variant="outlined" />
      </Tooltip>
    )
  }
  const updated = entry.questionsupdated > 0
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
