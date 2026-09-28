import { forwardRef } from 'react'
import IconButton, { IconButtonProps } from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

/**
 * Props for {@link IconActionButton}. Extends MUI IconButton but makes the
 * accessible label mandatory so an icon-only control can never ship without
 * a tooltip and an aria-label.
 */
export type IconActionButtonProps = Omit<IconButtonProps, 'aria-label'> & {
  /** Human-readable action name. Drives both the tooltip and the aria-label. */
  label: string
}

/**
 * Icon-only button that always carries a tooltip and an aria-label.
 *
 * Use this anywhere the old code rendered a bare IconButton with an icon and
 * no text, so every row action and toolbar icon is discoverable on hover and
 * readable by assistive tech.
 * @param {IconActionButtonProps} props - Button props plus the required label.
 * @returns {JSX.Element} A tooltip-wrapped, labeled icon button.
 */
const IconActionButton = forwardRef<HTMLButtonElement, IconActionButtonProps>(
  function IconActionButton({ label, children, ...rest }, ref) {
    return (
      <Tooltip title={label}>
        {/* span keeps the tooltip working even when the button is disabled */}
        <span style={{ display: 'inline-flex' }}>
          <IconButton ref={ref} aria-label={label} size="small" {...rest}>
            {children}
          </IconButton>
        </span>
      </Tooltip>
    )
  }
)

export default IconActionButton
