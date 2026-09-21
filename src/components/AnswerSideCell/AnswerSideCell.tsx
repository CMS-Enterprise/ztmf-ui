import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AISummaryBadge from '@/components/AISummaryBadge/AISummaryBadge'

/**
 * The structural minimum both callers satisfy, rather than either concrete
 * type. `ScoreDiffSide` requires optionname and score; a score revision omits
 * them when the catalog row it named has since been deleted, because
 * score_revisions carries no FK to the catalog so that history survives its
 * edits. Typing the intersection keeps the diff modal's call sites unchanged.
 */
export type AnswerSide = {
  optionname?: string
  score?: number
  notes: string | null
  notes_is_ai_summary?: boolean
}

type Props = {
  /** null renders the "No answer" placeholder (an unanswered side). */
  side: AnswerSide | null
}

/**
 * One side of an answer comparison: the option, its score, and the
 * justification with its AI-summary provenance. Extracted verbatim from
 * ScoreDiffModal's renderSide so the score-revision history drawer renders
 * before → after identically rather than growing a second dialect
 * (ztmf-misc#392).
 *
 * Returns a fragment, not a TableCell: the diff modal wraps it in its own
 * TableCell, and swallowing that here would change the table's DOM and the
 * 508 header/scope relationships around it.
 */
export default function AnswerSideCell({ side }: Props) {
  if (!side) {
    return <em style={{ color: '#666' }}>{'No answer'}</em>
  }
  return (
    <>
      <Typography variant="body2">{side.optionname}</Typography>
      {/* Guarded only because a revision side may omit it; the diff modal
          always supplies a score, so its output is unchanged. */}
      {side.score != null && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          score {side.score}/5
        </Typography>
      )}
      {side.notes && (
        <Box sx={{ mt: 0.5 }}>
          <AISummaryBadge show={side.notes_is_ai_summary === true} />
          <Typography
            variant="caption"
            display="block"
            sx={{ color: 'text.secondary', fontStyle: 'italic' }}
          >
            {side.notes}
          </Typography>
        </Box>
      )}
    </>
  )
}
