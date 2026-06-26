import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import { useContextProp } from '@/views/Title/Context'
import StatusChip from '@/components/ds/StatusChip'
import { colors, radius } from '@/theme/tokens'

/** Formats an ISO date string as e.g. "May 1, 2026". */
function formatDate(value: string | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Shared "DATACALL · [picker] · Active/Closed · Opens/Closes" card that any
 * datacall-scoped page can drop at the top of its body to declare which
 * datacall the content below corresponds to.
 *
 * Picker, status chip and Opens/Closes dates are all read from the Title
 * context, so the same instance is used on Dashboard, System Detail, Pillar
 * Scores, and Questionnaire without needing props. Selecting a different
 * datacall flows back into the same context and every downstream page reacts
 * to it.
 *
 * Renders nothing when no datacalls have loaded yet (the page should still
 * render its other content; the card just stays out of the way).
 * @returns {JSX.Element | null} The persistent datacall context card.
 */
export default function DatacallContextCard() {
  const { datacalls, selectedDatacall, setSelectedDatacall, latestDataCallId } =
    useContextProp()

  if (datacalls.length === 0) return null

  const isClosed = selectedDatacall
    ? new Date() > new Date(selectedDatacall.deadline)
    : false

  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        px: 2,
        py: 1.5,
        mb: 2,
        minHeight: 56,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colors.neutral500,
          whiteSpace: 'nowrap',
        }}
      >
        Datacall
      </Typography>

      {/* Searchable datacall picker. Styled to read like the old pill
          trigger (primary50 fill, primary text, compact 30px) while letting
          users type to narrow the list - useful when there are many
          historical datacalls. */}
      <Autocomplete
        size="small"
        options={datacalls}
        value={selectedDatacall ?? datacalls[0]}
        getOptionLabel={(dc) => dc.datacall}
        isOptionEqualToValue={(a, b) => a.datacallid === b.datacallid}
        onChange={(_event, dc) => {
          if (dc) setSelectedDatacall(dc)
        }}
        disableClearable
        renderOption={(props, option) => {
          const isCurrent = option.datacallid === latestDataCallId
          const closed = new Date() > new Date(option.deadline)
          const deadlineLabel = new Date(option.deadline).toLocaleDateString(
            'en-US',
            { month: 'short', day: 'numeric', year: 'numeric' }
          )
          const { key, ...rest } = props
          return (
            <li key={key} {...rest}>
              <Box sx={{ width: '100%' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {option.datacall}
                  </Typography>
                  {isCurrent && (
                    <Chip
                      label="Current"
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {closed ? 'Closed' : 'Active'} · deadline {deadlineLabel}
                </Typography>
              </Box>
            </li>
          )
        }}
        slotProps={{ paper: { sx: { minWidth: 280 } } }}
        sx={{
          minWidth: 240,
          '& .MuiInputBase-root': {
            height: 30,
            fontSize: 13,
            fontWeight: 600,
            color: colors.primary,
            backgroundColor: colors.primary50,
            borderRadius: `${radius.button}px`,
            py: '0 !important',
            paddingRight: '8px !important',
          },
          '& .MuiAutocomplete-input': {
            py: '0 !important',
            color: colors.primary,
          },
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '& .MuiAutocomplete-popupIndicator': { color: colors.primary },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Select datacall"
            inputProps={{
              ...params.inputProps,
              'aria-label': 'Select datacall',
            }}
          />
        )}
      />

      <StatusChip
        label={isClosed ? 'Closed' : 'Active'}
        kind={isClosed ? 'neutral' : 'active'}
      />

      <Box
        sx={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          fontSize: 13,
          fontWeight: 500,
          color: colors.neutral500,
          whiteSpace: 'nowrap',
        }}
      >
        <span>
          Opens{' '}
          <strong style={{ color: colors.ink }}>
            {formatDate(selectedDatacall?.datecreated)}
          </strong>
        </span>
        <span>
          Closes{' '}
          <strong style={{ color: colors.ink }}>
            {formatDate(selectedDatacall?.deadline)}
          </strong>
        </span>
      </Box>
    </Box>
  )
}
