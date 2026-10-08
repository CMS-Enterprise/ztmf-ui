import React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import UndoIcon from '@mui/icons-material/Undo'
import HistoryIcon from '@mui/icons-material/History'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AnswerSideCell from '@/components/AnswerSideCell/AnswerSideCell'
import SideDrawer from '@/components/ui/SideDrawer'
import EmptyState from '@/components/ui/EmptyState'
import { colors, radius } from '@/theme/tokens'
import { formatDateTime } from '@/utils/dates'
import { undoButtonLabel, undoPreview } from './undoState'
import type { ScoreRevision } from '@/types'

export const ANSWER_HISTORY_PANEL_ID = 'answer-history-panel'

type Props = {
  open: boolean
  onClose: () => void
  revisions: ScoreRevision[]
  isPending: boolean
  isError: boolean
  /** Disables the action while an undo is in flight. */
  isUndoing: boolean
  /** Undo the head revision. The panel never picks a target itself. */
  onUndo: (revisionid: number) => void
  /**
   * The page's own gate (canUndoAnswer), same as the strip's: unsaved edits or
   * an unresolved review withhold Undo even when the server allows it.
   */
  canUndo: boolean
}

/** Reads as a sentence about what happened, not as a column of enum values. */
function describeKind(kind: ScoreRevision['kind']): string {
  switch (kind) {
    case 'create':
      return 'Answered'
    case 'confirm':
      return 'Confirmed as still accurate'
    case 'undo':
      return 'Undid the previous change'
    case 'translate':
      return 'Carried to a new questionnaire version'
    default:
      return 'Changed the answer'
  }
}

/**
 * Right-anchored drawer showing one answer's revision history, newest first
 * (ztmf-misc#392).
 *
 * A Drawer rather than an extension of ScoreDiffModal: that modal is
 * cross-data-call, per-system and all-questions, while this is one call, one
 * score, N revisions - and its scrim would hide the very answer being compared
 * against. Only the before/after cell is shared, via AnswerSideCell.
 *
 * Undo eligibility is never re-derived here. The server marks each revision
 * undoable or not and supplies the reason; this renders that string verbatim,
 * so the rules live in exactly one place.
 */
export default function AnswerHistoryPanel({
  open,
  onClose,
  revisions,
  isPending,
  isError,
  isUndoing,
  onUndo,
  canUndo,
}: Props) {
  const head = revisions[0]

  return (
    // SideDrawer supplies the dialog semantics, the labelled title and the
    // focus trap; focus lands on the panel itself, which suits a read-mostly
    // list (WAI-ARIA dialog pattern).
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Answer history"
      id={ANSWER_HISTORY_PANEL_ID}
    >
      {/* No role="status" here: the questionnaire already has two live regions
          and the carry-forward chip announces the status change an undo makes. */}
      {isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {isError && (
        <Alert severity="error">
          Could not load this answer&apos;s history. Close the panel and try
          again.
        </Alert>
      )}

      {!isPending && !isError && revisions.length === 0 && (
        <EmptyState
          icon={<HistoryIcon />}
          tone="neutral"
          title="No recorded changes"
          description="No changes have been recorded for this answer in this data call."
        />
      )}

      {revisions.length > 0 && (
        <Box
          component="ol"
          aria-label="Revisions, newest first"
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {revisions.map((rev) => (
            <Box
              component="li"
              key={rev.revisionid}
              sx={{
                py: 4,
                '&:first-of-type': { pt: 0 },
                '&:not(:last-of-type)': {
                  borderBottom: `1px solid ${colors.neutral200}`,
                },
              }}
            >
              <Typography
                sx={{ fontSize: 13, fontWeight: 600, color: colors.ink }}
              >
                {describeKind(rev.kind)}
              </Typography>
              <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
                {rev.actor?.name ?? 'Unknown user'}
                {rev.actor?.role ? ` (${rev.actor.role})` : ''} -{' '}
                {formatDateTime(rev.createdat, rev.createdat)}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  mt: 2,
                  p: 3,
                  backgroundColor: colors.neutral50,
                  border: `1px solid ${colors.neutral200}`,
                  borderRadius: `${radius.md}px`,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <AnswerSideCell side={rev.prev} />
                </Box>
                <ArrowForwardIcon
                  // Decorative: the before/after relationship is already
                  // conveyed by the order of the two cells.
                  aria-hidden="true"
                  sx={{ fontSize: 16, color: colors.neutral400, mt: 0.5 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <AnswerSideCell side={rev.new} />
                </Box>
              </Box>

              {canUndo && rev.undoable && rev === head ? (
                <Box sx={{ mt: 3 }}>
                  <UndoAnswerButton
                    head={rev}
                    disabled={isUndoing}
                    onUndo={onUndo}
                    // Built from the row below the head, whose `new` side is by
                    // definition this head's `prev`.
                    preview={undoPreview({
                      restoresOptionName: rev.prev?.optionname,
                      restoresNotes: !!rev.prev?.notes,
                      savedAt: revisions[1]?.createdat,
                    })}
                  />
                </Box>
              ) : (
                rev.reason && (
                  <Typography
                    sx={{ mt: 2, fontSize: 12, color: colors.neutral500 }}
                  >
                    {rev.reason}
                  </Typography>
                )
              )}
            </Box>
          ))}
        </Box>
      )}
    </SideDrawer>
  )
}

type UndoButtonProps = {
  head: { revisionid: number; kind: ScoreRevision['kind'] }
  disabled: boolean
  onUndo: (revisionid: number) => void
  /**
   * What the action will restore, announced through aria-describedby. Omitted
   * when it cannot be described, in which case no describedby is emitted
   * rather than one pointing at empty text.
   */
  preview?: string
}

/**
 * The strip's inline shortcut, co-located with the drawer because the two
 * render the same action and must stay labelled the same way. Whether it is
 * offered at all is canUndoAnswer's decision, not this component's.
 */
export function UndoAnswerButton({
  head,
  disabled,
  onUndo,
  preview,
}: UndoButtonProps) {
  // Per instance: the strip's button stays mounted under the open drawer.
  const previewId = React.useId()
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<UndoIcon />}
        onClick={() => onUndo(head.revisionid)}
        disabled={disabled}
        aria-describedby={preview ? previewId : undefined}
        sx={{ textTransform: 'none' }}
      >
        {undoButtonLabel(head.kind)}
      </Button>
      {/* Hidden rather than visible: the value being restored is already on
          screen in the drawer, and repeating it beside the button would be
          noise for sighted users. A three-word label is the problem only for
          someone who cannot see the row it acts on. */}
      {preview && (
        <Box component="span" id={previewId} sx={visuallyHidden}>
          {preview}
        </Box>
      )}
    </>
  )
}
