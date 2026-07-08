import { ReactNode } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import IconActionButton from './IconActionButton'
import { colors, modalWidth } from '@/theme/tokens'

/** Named modal widths matching the design contract. */
export type ModalSize = keyof typeof modalWidth

/** Props for {@link Modal}. */
export type ModalProps = {
  /** Whether the modal is open. */
  open: boolean
  /** Called when the user dismisses via the X, Escape or backdrop. */
  onClose: () => void
  /** Main heading shown in the header. */
  title: ReactNode
  /** Optional small uppercase line above the title (for example a step). */
  eyebrow?: ReactNode
  /** Body content. */
  children: ReactNode
  /** Footer content, typically Cancel plus a primary action. */
  footer?: ReactNode
  /** One of the four allowed widths. Defaults to md. */
  size?: ModalSize
  /** Prevent closing on backdrop click (use for forms with unsaved input). */
  disableBackdropClose?: boolean
  /**
   * When true, reduces header / body / footer padding to ~half the default
   * for dense list-style dialogs (e.g. the Assign OpDivs picker). Opt-in so
   * existing form-heavy modals keep their roomier spacing.
   */
  dense?: boolean
}

/**
 * The single modal shell every dialog in the app renders through.
 *
 * One shape, one close affordance (X top-right, always), one footer layout
 * (actions right-aligned, Cancel left of the primary), and one of four fixed
 * widths. Replaces the three drifting modal styles the audit found. MUI Dialog
 * supplies the focus trap and return-focus-on-close behavior.
 * @param {ModalProps} props - Open state, handlers, header, body and footer.
 * @returns {JSX.Element} A consistent modal dialog.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = 'md',
  disableBackdropClose = false,
  dense = false,
}: ModalProps) {
  // Padding scales for the two density modes. Default is the roomy
  // form-modal spacing; dense halves it for list-style dialogs.
  const px = dense ? 2.5 : 5
  const headerPt = dense ? 2.25 : 4.5
  const headerPb = dense ? 1.75 : 3.5
  const bodyPy = dense ? 2 : 5
  const footerPy = dense ? 1.75 : 3.5

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (disableBackdropClose && reason === 'backdropClick') return
        onClose()
      }}
      aria-labelledby="ui-modal-title"
      PaperProps={{
        sx: { width: modalWidth[size], maxWidth: '92vw', m: 2 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px,
          pt: headerPt,
          pb: headerPb,
          borderBottom: `1px solid ${colors.neutral200}`,
        }}
      >
        <Box>
          {eyebrow && (
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: colors.neutral500,
                mb: 0.5,
              }}
            >
              {eyebrow}
            </Typography>
          )}
          <Typography
            id="ui-modal-title"
            component="h2"
            sx={{ fontSize: 17, fontWeight: 700, color: colors.ink }}
          >
            {title}
          </Typography>
        </Box>
        <IconActionButton
          label="Close"
          onClick={onClose}
          sx={{ mt: -0.5, mr: -1 }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconActionButton>
      </Box>

      <Box sx={{ px, py: bodyPy }}>{children}</Box>

      {footer && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 2,
            px,
            py: footerPy,
            backgroundColor: colors.neutral50,
            borderTop: `1px solid ${colors.neutral200}`,
          }}
        >
          {footer}
        </Box>
      )}
    </Dialog>
  )
}

export default Modal
