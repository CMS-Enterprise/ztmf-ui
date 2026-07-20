import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import StatusChip from '@/components/ui/StatusChip'
import { colors, radius } from '@/theme/tokens'
import {
  groupDatacallsByYear,
  parseDatacallName,
} from '@/utils/datacallGrouping'
import type { datacall } from '@/types'

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

/** Props for {@link DatacallContextCardView}. */
export type DatacallContextCardViewProps = {
  /** Every datacall the user can choose from. */
  datacalls: datacall[]
  /**
   * Currently-selected single datacall, or null while the dashboard is
   * aggregating the active year's calls.
   */
  selectedDatacall: datacall | null
  /**
   * Fired when the user picks a datacall, or with null when they clear the
   * pick to return to the aggregated year view.
   */
  onSelect: (dc: datacall | null) => void
  /**
   * Datacall id considered "latest" by the system; rendered with a "Current"
   * outlined chip inside the picker dropdown so users can spot the active
   * cycle without re-deriving it.
   */
  latestDataCallId: number
  /**
   * The data calls the dashboard is currently aggregating (the active
   * year's toggled-on calls). Drives the aggregate summary shown while no
   * single call is selected, and the Opens/Closes range on the right.
   */
  activeDatacallIds?: number[]
  /**
   * When true the picker becomes a non-interactive pill. Used on routes
   * where switching the datacall would have no effect (e.g. the System
   * Detail edit-mode view, where system metadata is not datacall-scoped).
   */
  readOnly?: boolean
  /**
   * Whether clearing the selection is meaningful. True only where there is
   * an aggregated view to fall back to (the dashboard's active year). Pages
   * that view one specific call have nothing to clear to, so the affordance
   * must not render - an X that does nothing is worse than no X.
   */
  clearable?: boolean
}

/**
 * Pure presentational shell for the datacall context card. Owns no state and
 * no context: the parent supplies the datacall list, current selection, and
 * the change handler. Keeping this layer pure means it can be rendered from
 * Storybook, dropped into snapshot tests, or composed under a different
 * data source without dragging Title-context coupling along with it.
 *
 * The interactive picker is a searchable Autocomplete styled to read like a
 * pill (primary50 fill, primary text, 30px height), with options grouped by
 * fiscal year (newest first) and labeled with their tenant (CMS quarterly /
 * HHS ZTM). While the dashboard is aggregating a whole year (no single call
 * selected), the picker shows an aggregate summary ("FY2026 - 3 calls") and
 * the right side shows the opens/closes range across those calls; clearing a
 * single-call pick returns to that aggregated view. When {@link readOnly} is
 * true the picker collapses to a non-interactive pill of the same shape.
 * @param {DatacallContextCardViewProps} props - Component props.
 * @returns {JSX.Element | null} The card markup, or null when the datacall
 *   list is empty (so callers can mount the card unconditionally).
 */
export default function DatacallContextCardView({
  datacalls,
  selectedDatacall,
  onSelect,
  latestDataCallId,
  activeDatacallIds = [],
  readOnly = false,
  clearable = true,
}: DatacallContextCardViewProps) {
  // Options flattened from the year groups so the Autocomplete's groupBy
  // always sees contiguous groups (newest year first, deadline order within
  // a year, unparseable names at the bottom).
  const groupedOptions = useMemo(
    () => groupDatacallsByYear(datacalls).flatMap((group) => group.calls),
    [datacalls]
  )
  const activeCalls = useMemo(
    () => datacalls.filter((dc) => activeDatacallIds.includes(dc.datacallid)),
    [datacalls, activeDatacallIds]
  )

  if (datacalls.length === 0) return null

  // Aggregating = the dashboard is merging more than one call and none is
  // singled out. The picker then shows a summary instead of pretending one
  // call is selected.
  const aggregating = !selectedDatacall && activeCalls.length > 1
  const aggregateYear =
    aggregating && activeCalls[0]
      ? parseDatacallName(activeCalls[0].datacall).fiscalYear
      : null
  const aggregateSummary = aggregating
    ? `${aggregateYear ? `FY${aggregateYear}` : 'All'} - ${activeCalls.length} calls`
    : ''

  // Opens/Closes: the selected call's own window, or the span across the
  // aggregated calls (earliest open to latest close).
  const windowCalls = selectedDatacall ? [selectedDatacall] : activeCalls
  const opensAt = windowCalls.reduce<string | undefined>(
    (min, dc) => (!min || dc.datecreated < min ? dc.datecreated : min),
    undefined
  )
  const closesAt = windowCalls.reduce<string | undefined>(
    (max, dc) => (!max || dc.deadline > max ? dc.deadline : max),
    undefined
  )
  // "Active" while any call in view is still open.
  const isClosed = windowCalls.length
    ? windowCalls.every((dc) => new Date() > new Date(dc.deadline))
    : false

  const pillLabel = selectedDatacall?.datacall ?? aggregateSummary

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

      {/* Read-only routes render the datacall as a static pill so the
          control does not falsely suggest the user can change scope. */}
      {readOnly ? (
        <Box
          aria-label={`Datacall: ${pillLabel}`}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 30,
            px: 1.5,
            fontSize: 13,
            fontWeight: 600,
            color: colors.primary,
            backgroundColor: colors.primary50,
            borderRadius: `${radius.button}px`,
            minWidth: 240,
            cursor: 'default',
          }}
        >
          {pillLabel}
        </Box>
      ) : (
        <Autocomplete
          size="small"
          options={groupedOptions}
          value={selectedDatacall}
          getOptionLabel={(dc) => dc.datacall}
          isOptionEqualToValue={(a, b) => a.datacallid === b.datacallid}
          groupBy={(dc) => {
            const { fiscalYear } = parseDatacallName(dc.datacall)
            return fiscalYear ? `FY${fiscalYear}` : 'Other'
          }}
          onChange={(_event, dc) => onSelect(dc)}
          // Clearing returns to the aggregated year view. Hidden while
          // already aggregating (nothing to clear) and on pages that view
          // one specific call (nothing to clear TO).
          disableClearable={!clearable || !selectedDatacall}
          clearText="Show the whole year"
          renderOption={(props, option) => {
            const isCurrent = option.datacallid === latestDataCallId
            const inActiveSet = activeDatacallIds.includes(option.datacallid)
            const closed = new Date() > new Date(option.deadline)
            const { tenant } = parseDatacallName(option.datacall)
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
                      {tenant !== 'Other' && (
                        <Box
                          component="span"
                          sx={{ color: colors.neutral500, fontWeight: 400 }}
                        >
                          {' '}
                          - {tenant}
                        </Box>
                      )}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {aggregating && inActiveSet && (
                        <Chip
                          label="In view"
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
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
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
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
            // The aggregate summary rides in the placeholder; keep it as
            // readable as a real value, not placeholder-gray.
            '& .MuiAutocomplete-input::placeholder': {
              color: colors.primary,
              opacity: 1,
              fontWeight: 600,
            },
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiAutocomplete-popupIndicator': { color: colors.primary },
            '& .MuiAutocomplete-clearIndicator': { color: colors.primary },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={aggregating ? aggregateSummary : 'Select datacall'}
              inputProps={{
                ...params.inputProps,
                'aria-label': aggregating
                  ? `Select datacall (viewing ${aggregateSummary})`
                  : 'Select datacall',
              }}
            />
          )}
        />
      )}

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
        {aggregating && (
          <span>
            Aggregating{' '}
            <strong style={{ color: colors.ink }}>
              {activeCalls.length} calls
            </strong>
          </span>
        )}
        <span>
          Opens{' '}
          <strong style={{ color: colors.ink }}>{formatDate(opensAt)}</strong>
        </span>
        <span>
          Closes{' '}
          <strong style={{ color: colors.ink }}>{formatDate(closesAt)}</strong>
        </span>
      </Box>
    </Box>
  )
}
