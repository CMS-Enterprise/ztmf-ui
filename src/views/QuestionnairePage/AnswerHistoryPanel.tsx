import React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import CloseIcon from '@mui/icons-material/Close'
import UndoIcon from '@mui/icons-material/Undo'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AnswerSideCell from '@/components/AnswerSideCell/AnswerSideCell'
import { undoButtonLabel, undoPreview } from './undoState'
import type { ScoreRevision } from '@/types'

export const ANSWER_HISTORY_TITLE_ID = 'answer-history-title'

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
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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
 * score, N revisions — and its scrim would hide the very answer being compared
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
}: Props) {
  const closeRef = React.useRef<HTMLButtonElement>(null)

  // Focus the close control on open, matching ScoreDiffModal's a11y skeleton.
  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => closeRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [open])

  const head = revisions[0]

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // Dialog semantics go on the Paper, not the Drawer. MUI renders the
      // Drawer root with role="presentation", which strips semantics, so an
      // aria-labelledby placed there is discarded and the panel announces as
      // nothing. Dialog does this for its own Paper automatically; Drawer does
      // not. axe will not catch it either - a missing dialog role on a custom
      // panel is an omission, not a violation - so the frostfall scan passing
      // is not evidence this is right.
      PaperProps={{
        id: 'answer-history-panel',
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': ANSWER_HISTORY_TITLE_ID,
        sx: { width: { xs: '100%', sm: 460 }, p: 2 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant="h2"
          sx={{ fontSize: 20 }}
          id={ANSWER_HISTORY_TITLE_ID}
        >
          Answer history
        </Typography>
        <IconButton
          ref={closeRef}
          onClick={onClose}
          aria-label="Close answer history"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* No role="status" here: the questionnaire already has two live regions
          and the carry-forward chip announces the status change an undo makes. */}
      {isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Could not load this answer&apos;s history. Close the panel and try
          again.
        </Alert>
      )}

      {!isPending && !isError && revisions.length === 0 && (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          No changes have been recorded for this answer in this data call.
        </Typography>
      )}

      {revisions.map((rev) => (
        <Box key={rev.revisionid} sx={{ mt: 2 }}>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {describeKind(rev.kind)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {rev.actor?.name ?? 'Unknown user'}
            {rev.actor?.role ? ` (${rev.actor.role})` : ''} —{' '}
            {formatWhen(rev.createdat)}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              mt: 1,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <AnswerSideCell side={rev.prev} />
            </Box>
            <ArrowForwardIcon
              fontSize="small"
              sx={{ color: 'text.secondary', mt: 0.5 }}
              // Decorative: the before/after relationship is already conveyed
              // by the order of the two cells.
              aria-hidden="true"
            />
            <Box sx={{ flex: 1 }}>
              <AnswerSideCell side={rev.new} />
            </Box>
          </Box>

          {rev.undoable && rev === head ? (
            <Box sx={{ mt: 1 }}>
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
                variant="caption"
                display="block"
                sx={{ mt: 1, color: 'text.secondary', fontStyle: 'italic' }}
              >
                {rev.reason}
              </Typography>
            )
          )}
        </Box>
      ))}
    </Drawer>
  )
}

export const UNDO_PREVIEW_ID = 'undo-action-preview'

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
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<UndoIcon />}
        onClick={() => onUndo(head.revisionid)}
        disabled={disabled}
        aria-describedby={preview ? UNDO_PREVIEW_ID : undefined}
        sx={{ textTransform: 'none' }}
      >
        {undoButtonLabel(head.kind)}
      </Button>
      {/* Hidden rather than visible: the value being restored is already on
          screen in the drawer, and repeating it beside the button would be
          noise for sighted users. A three-word label is the problem only for
          someone who cannot see the row it acts on. */}
      {preview && (
        <Box component="span" id={UNDO_PREVIEW_ID} sx={visuallyHidden}>
          {preview}
        </Box>
      )}
    </>
  )
}
