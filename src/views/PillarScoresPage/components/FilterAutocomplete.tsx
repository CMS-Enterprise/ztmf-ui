import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

/** Props for {@link FilterAutocomplete}. */
export type FilterAutocompleteProps = {
  /** Option labels to choose from. */
  options: string[]
  /** Current value, or null when nothing is selected. */
  value: string | null
  /** Called when the user picks (or clears) a value. */
  onChange: (next: string | null) => void
  /** Empty-state placeholder copy. */
  placeholder: string
  /** Accessible label - typically describes what filter this controls. */
  ariaLabel: string
}

/**
 * Compact 30px Autocomplete used for the pillar and tier filters on the
 * question-level breakdown. Plain string options; nothing fancy. Centralized
 * so both dropdowns render identically and any tweak to the visual treatment
 * (height, padding, spacing) lives in one place.
 * @param {FilterAutocompleteProps} props - Component props.
 * @returns {JSX.Element} A small searchable filter dropdown.
 */
export default function FilterAutocomplete({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: FilterAutocompleteProps) {
  return (
    <Autocomplete
      size="small"
      options={options}
      value={value}
      onChange={(_event, next) => onChange(next)}
      sx={{
        width: 170,
        '& .MuiInputBase-root': {
          height: 30,
          fontSize: 13,
          py: '0 !important',
        },
        '& .MuiAutocomplete-input': { py: '0 !important' },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          inputProps={{
            ...params.inputProps,
            'aria-label': ariaLabel,
          }}
        />
      )}
    />
  )
}
