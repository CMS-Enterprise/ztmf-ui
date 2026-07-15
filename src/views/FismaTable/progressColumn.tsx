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
 * "Updated this cycle" only has meaning for the current/active data call. For a
 * past call nobody has touched anything this cycle, so questionsupdated is 0 for
 * every system - showing "0/40 Not updated" wrongly reads a completed historical
 * call as missing (ztmf#537). A past call with a score for that system was
 * completed, so it gets a neutral "Complete" chip instead of the current-cycle
 * fraction and Updated/Not-updated chip.
 *
 * States:
 *   - past call (isCurrentCall false) with a score: neutral "Complete" chip -
 *     the score is the completion signal (ScoreProgress has no "total answered"
 *     field); the orange laggard chip never appears off the active call;
 *   - a system with no applicable questionnaire (0/0) renders a neutral
 *     "N/A" chip, not an orange "Not updated" one - it is not a laggard,
 *     there is nothing to nudge;
 *   - current call, any genuine edit: "Updated" (green);
 *   - current call, otherwise: "Not updated" (orange). The chip is derived from
 *     questionsupdated so it can never disagree with the fraction.
 * @param {object} props - Component props.
 * @param {ScoreProgress | undefined} props.entry - The system's progress row;
 *   undefined renders an em-dash (progress fetch failed or not covered).
 * @param {boolean} [props.isCurrentCall=true] - Whether the row's displayed call
 *   is the current/active one. Defaults true so callers without call context
 *   keep the original current-cycle rendering.
 * @param {boolean} [props.hasScore=false] - Whether the system has a score for
 *   the displayed call. Used only for a past call, where a score means the call
 *   was completed.
 * @returns {JSX.Element} The progress cell.
 */
export function ProgressCell({
  entry,
  isCurrentCall = true,
  hasScore = false,
}: {
  entry: ScoreProgress | undefined
  isCurrentCall?: boolean
  hasScore?: boolean
}) {
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
  // A past data call is closed: "updated this cycle" is meaningless, so never
  // show the orange laggard chip here. A score for the call means it was
  // completed - show a neutral "Complete" chip. Without a score (should not
  // happen for a row the table drew from score data) fall back to the em-dash
  // rather than a misleading fraction.
  if (!isCurrentCall) {
    if (!hasScore) {
      return <span aria-label="No progress data">—</span>
    }
    return (
      <Tooltip title={progressTooltip(entry, { completed: true })}>
        <Chip size="small" label="Complete" variant="outlined" />
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
