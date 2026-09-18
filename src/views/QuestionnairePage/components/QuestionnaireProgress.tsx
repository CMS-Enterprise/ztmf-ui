import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'

/** Props for {@link QuestionnaireProgress}. */
export type QuestionnaireProgressProps = {
  /** Questions answered across the whole questionnaire (every pillar). */
  answered: number
  /** Total questions across the whole questionnaire. */
  total: number
}

// Taller than the 5px section-progress bar in the right rail so "overall"
// outranks "this section" by visual weight, not just by label.
const BAR_HEIGHT = 10

/**
 * Whole-questionnaire completion bar for the page header. Owns the overall
 * "answered of total" status as a determinate bar so the reader gauges how far
 * through every pillar they are at a glance. Deliberately one color (primary):
 * this measures completion, not maturity - the tier palette stays reserved for
 * scores. Save status is not shown here; the footer save indicator owns it.
 *
 * The right-hand percent gives a non-color read of the same value, and the
 * answered/total count rides in the bar's accessible name so a screen reader
 * hears the counts, not just the percent.
 * @param {QuestionnaireProgressProps} props - Answered and total counts.
 * @returns {JSX.Element} The progress bar, or a height-reserving skeleton
 *   before questions load.
 */
export default function QuestionnaireProgress({
  answered,
  total,
}: QuestionnaireProgressProps) {
  // Reserve the row's height before questions load, so the datacall card below
  // does not jump up and then get shoved down when the bar appears.
  if (total <= 0) {
    return (
      <Box sx={{ mt: -1, mb: 2.5 }} aria-hidden>
        <Skeleton variant="text" width={180} sx={{ fontSize: 13, mb: 1 }} />
        <Skeleton
          variant="rounded"
          height={BAR_HEIGHT}
          sx={{ borderRadius: 999 }}
        />
      </Box>
    )
  }

  // Floor, never round: a rounded 99.5% would fill the bar and claim "100%"
  // while a question is still unanswered. 100% is reserved for real completion.
  const pct =
    answered >= total ? 100 : Math.min(99, Math.floor((answered / total) * 100))

  return (
    <Box sx={{ mt: -1, mb: 2.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 2,
          mb: 1,
        }}
      >
        <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
          <Box component="span" sx={{ fontWeight: 600, color: colors.ink }}>
            {answered} of {total}
          </Box>{' '}
          questions answered
        </Typography>
        <Typography
          sx={{ fontSize: 13, fontWeight: 700, color: colors.primary }}
        >
          {pct}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        aria-label={`Overall questionnaire completion, ${answered} of ${total} questions answered`}
        sx={{
          height: BAR_HEIGHT,
          borderRadius: 999,
          backgroundColor: colors.neutral200,
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            backgroundColor: colors.primary,
          },
        }}
      />
    </Box>
  )
}
