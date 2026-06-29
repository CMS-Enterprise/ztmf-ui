import { ReactNode } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'

/** Props for {@link CompactSwitchLabel}. */
export type CompactSwitchLabelProps = {
  /** Whether the switch is on. */
  checked: boolean
  /** Called when the user flips the switch. */
  onChange: (checked: boolean) => void
  /** Right-side label. */
  label: ReactNode
  /** Optional accessible label override. */
  ariaLabel?: string
}

/**
 * Compact pill-style on/off toggle used in every table toolbar across the
 * app (Dashboard, Users, OpDivs).
 *
 * Built on top of MUI's Switch but sized to sit flush on the 30px control
 * row used by table toolbars: 32x18 track, 14x14 thumb, recalculated
 * checked-state transform so the thumb actually reaches the right edge
 * (MUI's default transform assumes the standard 58x38 size and is off when
 * the switch is shrunk).
 * @param {CompactSwitchLabelProps} props - Component props.
 * @returns {JSX.Element} The compact switch + label.
 */
export function CompactSwitchLabel({
  checked,
  onChange,
  label,
  ariaLabel,
}: CompactSwitchLabelProps) {
  return (
    <FormControlLabel
      sx={{
        m: 0,
        '& .MuiSwitch-root': {
          width: 32,
          height: 18,
          padding: 0,
          mr: 1,
        },
        '& .MuiSwitch-switchBase': {
          padding: 0,
          margin: '2px',
          transitionDuration: '200ms',
          '&.Mui-checked': {
            // root.width - thumb.width - margin*2 = 32 - 14 - 4 = 14
            transform: 'translateX(14px)',
            color: colors.white,
            '& + .MuiSwitch-track': {
              opacity: 1,
              backgroundColor: colors.primary,
            },
          },
        },
        '& .MuiSwitch-thumb': {
          width: 14,
          height: 14,
          boxShadow: 'none',
          backgroundColor: colors.white,
        },
        '& .MuiSwitch-track': {
          borderRadius: 999,
          backgroundColor: colors.neutral400,
          opacity: 1,
        },
      }}
      control={
        <Switch
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          inputProps={ariaLabel ? { 'aria-label': ariaLabel } : undefined}
        />
      }
      label={
        typeof label === 'string' ? (
          <Typography sx={{ fontSize: 13 }}>{label}</Typography>
        ) : (
          label
        )
      }
    />
  )
}

export default CompactSwitchLabel
