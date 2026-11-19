import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import { visuallyHidden } from '@mui/utils'
import { colors } from '@/theme/tokens'
import SaveIndicator, { type SaveIndicatorProps } from './SaveIndicator'

// Ties the forward button's hint (Next or Complete) to the button as a
// description, so keyboard and screen-reader users get it on focus rather
// than only on hover.
const NAV_HINT_ID = 'questionnaire-nav-hint'

/** Props for {@link QuestionNavFooter}. */
export type QuestionNavFooterProps = {
  previousDisabled: boolean
  onPrevious: () => void
  /** The save indicator between the two buttons. */
  saveIndicator: SaveIndicatorProps
  /** Opens the answer history. Omitted when there is none to show. */
  onViewHistory?: () => void
  nextDisabled: boolean
  onNext: () => void
  /** "Complete" on the last question, "Next question >" otherwise. */
  nextLabel: string
  /** What the forward button does; empty suppresses the tooltip. */
  navHint: string
}

/**
 * The question card's bottom row: Previous on the left, the save indicator
 * and "View history" in the middle, Next or Complete on the right.
 * @param {QuestionNavFooterProps} props - Component props.
 * @returns {JSX.Element} The footer row.
 */
export default function QuestionNavFooter({
  previousDisabled,
  onPrevious,
  saveIndicator,
  onViewHistory,
  nextDisabled,
  onNext,
  nextLabel,
  navHint,
}: QuestionNavFooterProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mt: 3,
        pt: 2,
        borderTop: `1px solid ${colors.neutral200}`,
      }}
    >
      <Button
        variant="text"
        color="primary"
        disabled={previousDisabled}
        onClick={onPrevious}
        sx={{ fontSize: 13, fontWeight: 600 }}
      >
        {'< Previous'}
      </Button>
      {/* The history trigger sits beside the save indicator rather than inside
          it. SaveIndicator renders LastEditedFooter as a Tooltip title, and a
          link in tooltip content is hover-only: unreachable by keyboard and
          absent from the DOM until the pointer arrives. Grouped in a Box so
          the row keeps its three-child space-between layout. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SaveIndicator {...saveIndicator} />
        {/* History stays readable on a closed call, where admins can still
            undo from the drawer but the strip is absent. */}
        {onViewHistory && (
          <Link
            id="view-answer-history"
            component="button"
            type="button"
            onClick={onViewHistory}
            // Matches the SaveIndicator text it sits beside.
            sx={{ fontSize: 12, fontWeight: 600 }}
          >
            View history
          </Link>
        )}
      </Box>
      {/* The tooltip states that the forward action saves this question on
          its own (#705). describeChild so MUI applies aria-description, not
          aria-label, over the button text; the visually-hidden span mirrors
          it for keyboard and screen-reader users. */}
      <Tooltip title={navHint} describeChild>
        <span>
          <Button
            variant="contained"
            color="primary"
            disabled={nextDisabled}
            aria-describedby={navHint ? NAV_HINT_ID : undefined}
            onClick={onNext}
            sx={{ fontSize: 13 }}
          >
            {nextLabel}
          </Button>
          <Box component="span" id={NAV_HINT_ID} sx={visuallyHidden}>
            {navHint}
          </Box>
        </span>
      </Tooltip>
    </Box>
  )
}
