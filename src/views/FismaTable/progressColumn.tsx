import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import type { ScoreProgress } from '@/types'
import { hasNoQuestionnaire, progressTooltip } from './progressHelpers'

/**
 * Focusable tooltip wrapper for a progress state. tabIndex makes the content
 * keyboard-reachable so the MUI Tooltip opens on focus (hover-only tooltips
 * are invisible to keyboard users), and the aria-label gives screen readers
 * the full state in one announcement instead of a bare "12/41".
 * @param {object} props - Component props.
 * @param {string} props.tooltip - Tooltip text (also part of the accessible name).
 * @param {string} props.label - Short state description for the accessible name.
 * @param {React.ReactNode} props.children - The visual cell content.
 * @returns {JSX.Element} The focusable, labeled tooltip wrapper.
 */
function ProgressState({
  tooltip,
  label,
  children,
}: {
  tooltip: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip title={tooltip}>
      <Box
        tabIndex={0}
        aria-label={`${label}. ${tooltip}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: 1,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        {children}
      </Box>
    </Tooltip>
  )
}

/**
 * Cell body for the Data Call Progress column: an updated-count fraction
 * ("12/41") next to a status chip, wrapped in a focusable tooltip carrying
 * the last-activity time. Pre-populated answers carried over from the
 * previous data call do not count as updated - the fraction reflects genuine
 * edits this cycle (ztmf#299).
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
  // The em-dash is decoration; the hidden text is the announcement.
  const noData = (
    <span>
      <span aria-hidden>—</span>
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
        }}
      >
        No progress data
      </span>
    </span>
  )
  if (!entry) {
    return noData
  }
  if (hasNoQuestionnaire(entry)) {
    return (
      <ProgressState tooltip={progressTooltip(entry)} label="Not applicable">
        <Chip size="small" label="N/A" variant="outlined" />
      </ProgressState>
    )
  }
  // A past data call is closed: "updated this cycle" is meaningless, so never
  // show the orange laggard chip here. But completion is answered/total, NOT
  // updated/total - imported and carried-over answers are answered yet never
  // "updated this cycle", so gating on updates (or on mere score presence)
  // would either drop them or, worse, mask a partially-answered historical
  // call as done. Prefer QuestionsAnswered (ztmf#437): a fully-answered past
  // call is a neutral "Complete"; a partially-answered one shows an honest
  // answered/total with an "Incomplete" chip. Until the backend field ships,
  // fall back to the prior score-presence proxy.
  if (!isCurrentCall) {
    const answered = entry.questionsanswered
    if (answered == null) {
      if (!hasScore) {
        return noData
      }
      return (
        <ProgressState
          tooltip={progressTooltip(entry, { completed: true })}
          label="Complete"
        >
          <Chip size="small" label="Complete" variant="outlined" />
        </ProgressState>
      )
    }
    if (answered >= entry.questionsexpected) {
      return (
        <ProgressState
          tooltip={progressTooltip(entry, { completed: true })}
          label="Complete"
        >
          <Chip size="small" label="Complete" variant="outlined" />
        </ProgressState>
      )
    }
    return (
      <ProgressState
        tooltip={progressTooltip(entry)}
        label={`Incomplete, ${answered} of ${entry.questionsexpected} questions answered`}
      >
        <span>
          {answered}/{entry.questionsexpected}
        </span>
        <Chip
          size="small"
          label="Incomplete"
          color="warning"
          variant="outlined"
        />
      </ProgressState>
    )
  }
  const updated = entry.questionsupdated > 0
  return (
    <ProgressState
      tooltip={progressTooltip(entry)}
      label={`${updated ? 'Updated' : 'Not updated'}, ${entry.questionsupdated} of ${entry.questionsexpected} questions updated this data call`}
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
    </ProgressState>
  )
}
