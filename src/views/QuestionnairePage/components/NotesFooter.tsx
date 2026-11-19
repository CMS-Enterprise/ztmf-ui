import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'
import { MAX_QUESTIONNAIRE_NOTES_LENGTH } from '@/constants'
import AISummaryBadge from '@/components/AISummaryBadge/AISummaryBadge'

/** Props for {@link NotesFooter}. */
export type NotesFooterProps = {
  /** The saved notes are an AI summary. */
  showAiBadge: boolean
  /** Guidance under the notes. Omitted when JustificationField owns it. */
  prompt?: string
  /** Characters typed. Omitted when there is no counter to show. */
  count?: number
}

const counterColor = (count: number) =>
  count >= MAX_QUESTIONNAIRE_NOTES_LENGTH
    ? colors.danger
    : count >= MAX_QUESTIONNAIRE_NOTES_LENGTH * 0.9
      ? '#A34200'
      : colors.neutral500

/**
 * The row under the notes editor: the AI-summary badge and the prompt on the
 * left, the character counter on the right.
 * @param {NotesFooterProps} props - Component props.
 * @returns {JSX.Element} The footer row.
 */
export default function NotesFooter({
  showAiBadge,
  prompt,
  count,
}: NotesFooterProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        mt: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AISummaryBadge show={showAiBadge} />
        {prompt !== undefined && (
          <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
            {prompt}
          </Typography>
        )}
      </Box>
      {count !== undefined && (
        <Typography sx={{ fontSize: 12, color: counterColor(count) }}>
          {count} / {MAX_QUESTIONNAIRE_NOTES_LENGTH}
        </Typography>
      )}
    </Box>
  )
}
