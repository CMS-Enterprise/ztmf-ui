import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import { colors } from '@/theme/tokens'
import { MAX_QUESTIONNAIRE_NOTES_LENGTH } from '@/constants'

/** Shown when a question has no notes prompt of its own. */
export const DEFAULT_NOTES_PROMPT =
  'Link policies or screenshots in your evidence repo.'

const NotesTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#000000',
      borderWidth: '2px',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#000000',
      borderWidth: '2px',
      boxShadow: '0px 0px 0px 3px #FFFFFF, 0px 0px 3px 6px #bd13b8',
    },
    '@supports (-moz-appearance:none)': {
      paddingTop: '30px',
      '& .MuiInputBase-inputMultiline': {
        height: '100%',
        width: '100%',
        scrollbarWidth: 'none',
      },
    },
    '& .MuiInputBase-inputMultiline': {
      msOverflowStyle: 'none', // Hide scrollbar in IE/Edge
      '&::-webkit-scrollbar': { display: 'none' },
    },
  },
})

/** Props for {@link EvidenceNotesField}. */
export type EvidenceNotesFieldProps = {
  value: string
  onChange: (value: string) => void
  /** The question's notes prompt, used as the placeholder when set. */
  notePrompt: string
  disabled: boolean
  /** Set when a changed answer needs its notes updated too. */
  errorText?: string
}

/**
 * The plain "Supporting evidence - optional" notes editor, for a question
 * with no carried-forward response or Insights suggestion. Those questions
 * use JustificationField instead.
 * @param {EvidenceNotesFieldProps} props - Component props.
 * @returns {JSX.Element} The label and text field.
 */
export default function EvidenceNotesField({
  value,
  onChange,
  notePrompt,
  disabled,
  errorText,
}: EvidenceNotesFieldProps) {
  return (
    <>
      <Typography
        component="label"
        htmlFor="questionnaire-notes"
        sx={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: colors.ink,
          mt: 3,
          mb: 0.5,
        }}
      >
        Supporting evidence{' '}
        <Box
          component="span"
          sx={{ color: colors.neutral500, fontWeight: 500 }}
        >
          - optional
        </Box>
      </Typography>
      <NotesTextField
        id="questionnaire-notes"
        multiline
        rows={4}
        fullWidth
        value={value}
        disabled={disabled}
        error={!!errorText}
        helperText={errorText}
        placeholder={notePrompt || DEFAULT_NOTES_PROMPT}
        inputProps={{ maxLength: MAX_QUESTIONNAIRE_NOTES_LENGTH }}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  )
}
