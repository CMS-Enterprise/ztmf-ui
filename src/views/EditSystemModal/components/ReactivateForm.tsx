import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

/** Props for {@link ReactivateForm}. */
export interface ReactivateFormProps {
  /** Controlled notes textarea value. */
  notes: string
  /** Controlled notes setter. */
  setNotes: (value: string) => void
  /** Opens the "are you sure" reactivate confirmation dialog. */
  onConfirm: () => void
  /** Closes the form without confirming. */
  onCancel: () => void
}

/**
 * Reactivate sub-form rendered inside EditSystemModal for a decommissioned
 * system: an optional-notes textarea (500-char cap) plus the
 * Reactivate / Cancel buttons. Notes are optional - the API treats them
 * as a free-text audit field on the reactivation event.
 * @param {ReactivateFormProps} props - Controlled state + handlers.
 * @returns {JSX.Element} The sub-form.
 */
export default function ReactivateForm({
  notes,
  setNotes,
  onConfirm,
  onCancel,
}: ReactivateFormProps) {
  return (
    <Box sx={{ ml: 2, mt: 2 }}>
      <Typography variant="body2" sx={{ mt: 0, mb: 0.5, fontWeight: 500 }}>
        Reactivation Notes (optional)
      </Typography>
      <textarea
        value={notes}
        maxLength={500}
        rows={3}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reason for reactivation..."
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
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={onConfirm}
        >
          Reactivate
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
    </Box>
  )
}
