import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'

/**
 * Shared input wrapper used by every form modal in the app (Add FISMA system,
 * Email users, Create / Edit OpDiv, Create datacall, etc).
 *
 * Renders a static label above the control, the caller-supplied input
 * (OutlinedInput, Select, native input, etc), and optional helper or error
 * text below. This is intentionally NOT a floating-label TextField - the CMS
 * DSG global stylesheet collides with MUI's floating-label notch, and a
 * static-label layout matches the redesign mock directly.
 *
 * Consumers should style their input control with {@link fieldInputSx} so the
 * 38px height + 14px text + neutral-200 border match every other field across
 * the app. Wrap the input in a <Field id label> with the same `id` you pass
 * via `inputProps.id` so the label correctly forwards focus.
 *
 * @param {object} props - Component props.
 * @param {string} props.id - The id of the inner input element (used by the
 *   label's `htmlFor`).
 * @param {string} props.label - The visible label text.
 * @param {boolean} [props.required] - Show a muted asterisk after the label.
 * @param {string} [props.error] - Error message; mutually exclusive with
 *   helperText. When present, suppresses the helper line.
 * @param {string} [props.helperText] - Optional guidance text rendered in
 *   muted color below the input.
 * @param {ReactNode} props.children - The input control to render.
 * @returns {JSX.Element} A labelled field row.
 */
export type FieldProps = {
  id: string
  label: string
  required?: boolean
  error?: string
  helperText?: string
  children: ReactNode
}

const labelSx = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: colors.ink,
  mb: 0.75,
}

const errorTextSx = {
  color: colors.danger,
  mt: 0.5,
  display: 'block',
  fontWeight: 500,
}

const helperTextSx = {
  color: colors.neutral500,
  mt: 0.5,
  display: 'block',
}

const requiredMark = (
  <span style={{ color: colors.neutral500, fontWeight: 400 }}>*</span>
)

/**
 * Common sx for the input control inside a {@link Field}. Pass to OutlinedInput,
 * Select, or any other MUI input so every form modal has the same input
 * height, font size, padding, and border color.
 */
export const fieldInputSx = {
  fontSize: 14,
  // Root height is the visual contract: 38px for single-line inputs, auto
  // for multiline. Inner element heights are intentionally NOT set; setting
  // both root + .MuiSelect-select causes MUI Select to double-stack the
  // chrome and render at ~58px instead of 38px.
  '&.MuiInputBase-root': {
    height: 38,
  },
  '&.MuiInputBase-multiline': {
    height: 'auto',
    minHeight: 38,
    padding: 0,
  },
  '& .MuiOutlinedInput-input': {
    padding: '0 12px',
  },
  '& .MuiInputBase-inputMultiline': {
    padding: '12px',
  },
  // Select renders its current value inside .MuiSelect-select; center it
  // within the 38px root and reserve room for the dropdown arrow.
  '& .MuiSelect-select': {
    padding: '0 32px 0 12px',
    display: 'flex',
    alignItems: 'center',
    minHeight: '0 !important',
  },
  '& fieldset': { borderColor: colors.neutral200 },
}

export function Field({
  id,
  label,
  required,
  error,
  helperText,
  children,
}: FieldProps) {
  // The label gets a stable id so MUI Select / Autocomplete consumers can
  // wire it up as their accessible name via `labelId` / `aria-labelledby`.
  // Native <input>/<textarea> consumers ignore it; `htmlFor` still focuses
  // the input on label click.
  return (
    <Box>
      <Typography
        component="label"
        htmlFor={id}
        id={`${id}-label`}
        sx={labelSx}
      >
        {label} {required && requiredMark}
      </Typography>
      {children}
      {error ? (
        <Typography variant="caption" sx={errorTextSx}>
          {error}
        </Typography>
      ) : helperText ? (
        <Typography variant="caption" sx={helperTextSx}>
          {helperText}
        </Typography>
      ) : null}
    </Box>
  )
}

export default Field
