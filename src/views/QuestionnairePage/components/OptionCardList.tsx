import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import { colors, radius } from '@/theme/tokens'
import type { QuestionChoice } from '@/types'

/** Props for {@link OptionCardList}. */
export type OptionCardListProps = {
  /** Available choices for the current question. */
  options: QuestionChoice[]
  /** functionoptionid of the currently selected option; -1 for none. */
  selectedValue: number
  /** Called when the user picks an option. */
  onChange: (value: number) => void
  /** When true, options render unfocusable and non-interactive. */
  disabled: boolean
}

/**
 * Stack of selectable option cards for a single questionnaire question.
 * Each card is keyboard-accessible (role="radio", Enter/Space to pick) and
 * shows its selected/unselected state with a colored border, a fill, and
 * a swapped radio icon.
 *
 * The label is rendered as plain text (no markdown) because the source
 * options arrive as strings from the backend - if rich formatting becomes
 * a requirement, opt in at the call site rather than reaching for a
 * markdown library here.
 * @param {OptionCardListProps} props - Component props.
 * @returns {JSX.Element | null} The option card list, or null when there
 *   are no options to render.
 */
export default function OptionCardList({
  options,
  selectedValue,
  onChange,
  disabled,
}: OptionCardListProps) {
  if (!options.length) return null
  return (
    <Box
      role="radiogroup"
      aria-label="Answer options"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
    >
      {options.map((opt) => {
        const value = Number(opt.value)
        const selected = value === selectedValue
        return (
          <Box
            key={value}
            role="radio"
            aria-checked={selected}
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (!disabled) onChange(value)
            }}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onChange(value)
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: `${radius.md}px`,
              border: `1px solid ${selected ? colors.primary : colors.neutral200}`,
              backgroundColor: selected ? colors.primary50 : colors.white,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.7 : 1,
              transition: 'border-color 0.15s, background-color 0.15s',
              '&:hover': {
                borderColor: disabled
                  ? colors.neutral200
                  : selected
                    ? colors.primary
                    : colors.border,
              },
            }}
          >
            {selected ? (
              <RadioButtonCheckedIcon
                sx={{ fontSize: 18, color: colors.primary, mt: 0.25 }}
              />
            ) : (
              <RadioButtonUncheckedIcon
                sx={{ fontSize: 18, color: colors.neutral500, mt: 0.25 }}
              />
            )}
            <Typography
              sx={{
                fontSize: 13,
                color: colors.ink,
                fontWeight: selected ? 600 : 500,
                lineHeight: 1.5,
              }}
            >
              {String(opt.label)}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
