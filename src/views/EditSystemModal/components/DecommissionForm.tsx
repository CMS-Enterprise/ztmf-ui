import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { getTodayISO } from '../helpers'

/** Props for {@link DecommissionForm}. */
export interface DecommissionFormProps {
  /** Controlled date value (`yyyy-mm-dd`). */
  date: string
  /** Controlled date setter. */
  setDate: (value: string) => void
  /** Inline date error string; empty when no error. */
  dateError: string
  /**
   * Stateful date validator; called on input blur and before opening the
   * confirm dialog. Returns true when the date is valid for submission.
   */
  checkDate: (value: string) => boolean
  /** Controlled notes textarea value. */
  notes: string
  /** Controlled notes setter. */
  setNotes: (value: string) => void
  /**
   * Primary action click - typically opens the "are you sure" dialog.
   * Called only after checkDate returns true.
   */
  onConfirm: () => void
  /**
   * Optional cancel handler. When provided, a Cancel button renders
   * alongside the primary action. (The "edit decommission details" flow
   * needs this; the initial-decommission flow does not.)
   */
  onCancel?: () => void
  /** Primary button label - varies by variant ("Decommission" / "Update"). */
  confirmLabel: string
  /**
   * Primary button color. The first-time decommission uses 'error' (red)
   * because it's destructive; the "edit details" flow uses 'primary'
   * because it's just amending an existing decommissioned state.
   */
  confirmColor?: 'primary' | 'error'
  /**
   * Left margin (in MUI spacing units) for the wrapping Box. The two
   * variants nest at different indents; 2 for "edit details", 4 for
   * the first-time toggle.
   */
  marginLeft?: number
}

/**
 * Decommission sub-form rendered inside EditSystemModal: a controlled date
 * picker (with HTML5 max=today guard), a notes textarea (500-char cap),
 * and a primary action button (plus optional Cancel).
 *
 * Used in two places: the "Edit Decommission Details" affordance for an
 * already-decommissioned system, and the "Decommission System" toggle
 * for an active system. The two variants differ only in indentation,
 * button label, button color, and whether a Cancel button is shown - all
 * threaded through as props so the rendered form is one component.
 * @param {DecommissionFormProps} props - Controlled state + handlers + variant flags.
 * @returns {JSX.Element} The sub-form.
 */
export default function DecommissionForm({
  date,
  setDate,
  dateError,
  checkDate,
  notes,
  setNotes,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmColor = 'primary',
  marginLeft = 2,
}: DecommissionFormProps) {
  return (
    <Box sx={{ ml: marginLeft, mt: 1 }}>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
        Decommission Date
      </Typography>
      <input
        type="date"
        value={date}
        max={getTodayISO()}
        onChange={(e) => {
          setDate(e.target.value)
          if (dateError) checkDate(e.target.value)
        }}
        onBlur={(e) => checkDate(e.currentTarget.value)}
        style={{
          width: '100%',
          padding: '8px',
          fontSize: '14px',
          border: dateError ? '1px solid #d32f2f' : '1px solid #ccc',
          borderRadius: '4px',
          boxSizing: 'border-box',
        }}
      />
      {dateError && (
        <Typography
          variant="caption"
          sx={{ color: '#d32f2f', mt: 0.5, display: 'block' }}
        >
          {dateError}
        </Typography>
      )}
      <Typography variant="body2" sx={{ mt: 2, mb: 0.5, fontWeight: 500 }}>
        Notes (optional)
      </Typography>
      <textarea
        value={notes}
        maxLength={500}
        rows={3}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reason for decommission..."
        style={{
          width: '100%',
          padding: '8px',
          fontSize: '14px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
      >
        {notes.length}/500
      </Typography>
      {onCancel ? (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color={confirmColor}
            size="small"
            onClick={() => {
              if (checkDate(date)) onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </Box>
      ) : (
        <Button
          variant="contained"
          color={confirmColor}
          onClick={() => {
            if (checkDate(date)) onConfirm()
          }}
          sx={{ mt: 3 }}
        >
          {confirmLabel}
        </Button>
      )}
    </Box>
  )
}
