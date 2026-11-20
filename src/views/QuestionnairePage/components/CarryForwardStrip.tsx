import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { status } from '@/theme/tokens'
import { outlinedChipSx } from '@/utils/chipStyles'
import type { CarryForwardState } from '../confirmState'

// Ties the guidance line to the Confirm button it explains, so a screen
// reader hears the reason with the action.
const HELPER_ID = 'carried-forward-confirm-helper'

/** Props for {@link CarryForwardStrip}. */
export type CarryForwardStripProps = {
  /** The answer's carried-forward state on this call. */
  state: CarryForwardState
  /** Offer "Confirm this answer is still accurate". */
  showConfirm: boolean
  /** A confirm is in flight. */
  confirming: boolean
  onConfirm: () => void
  /** Show the review guidance line under the strip. */
  showHelper: boolean
  /** The Undo control, when one applies. */
  undo?: ReactNode
}

/**
 * The carried-forward confirmation strip, in the same zone where the
 * prior-response flow surfaces its "review before continuing" message, so
 * every system shares one review area.
 *
 * The chip is a role="status" live region, so confirming (which swaps its
 * label in place) is announced (508). The page hides the Confirm and Undo
 * controls the moment the question is dirty: the edit is the explicit act and
 * Next saves it, and Next never writes on an untouched question (#413).
 * @param {CarryForwardStripProps} props - Component props.
 * @returns {JSX.Element} The strip and its guidance line.
 */
export default function CarryForwardStrip({
  state,
  showConfirm,
  confirming,
  onConfirm,
  showHelper,
  undo,
}: CarryForwardStripProps) {
  const unconfirmed = state === 'unconfirmed'
  return (
    <>
      {state !== 'none' && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mt: 1.5,
          }}
        >
          <Chip
            role="status"
            size="small"
            variant="outlined"
            color={unconfirmed ? 'warning' : 'success'}
            // Outlined warning reads at 3.1:1 on white; success clears AA on
            // its own (ui#714).
            sx={unconfirmed ? outlinedChipSx('warning') : undefined}
            label={
              unconfirmed
                ? 'Carried forward - not yet confirmed'
                : 'Updated this data call'
            }
          />
          {showConfirm && (
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<CheckCircleOutlineIcon />}
              onClick={onConfirm}
              disabled={confirming}
              aria-describedby={showHelper ? HELPER_ID : undefined}
              sx={{ textTransform: 'none' }}
            >
              Confirm this answer is still accurate
            </Button>
          )}
          {/* Third child of the strip, which already wraps and gaps. */}
          {undo}
        </Box>
      )}
      {/* "before continuing" is advisory on purpose: Next is not blocked on
          this variant. Plain text, not a live region - the chip owns the
          announcement. */}
      {showHelper && (
        <Typography
          id={HELPER_ID}
          sx={{ mt: 0.5, fontSize: 12, color: status.warning.color }}
        >
          Review the carried-forward answer and confirm it, or write a new
          justification, before continuing.
        </Typography>
      )}
    </>
  )
}
