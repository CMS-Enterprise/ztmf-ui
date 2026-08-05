import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CloseIcon from '@mui/icons-material/Close'
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
   * aggregating more than one of the active year's calls.
   */
  selectedDatacall: datacall | null
  /**
   * Fired when the user picks a datacall (single-pick mode), or with null
   * when they clear back to the aggregated year view.
   */
  onSelect: (dc: datacall | null) => void
  /**
   * Multi-select toggle (#467). When provided, the dropdown renders checkbox
   * rows and stays open across clicks: a call in a different year switches
   * to that whole year, a call in the active year toggles on/off (the
   * caller's rules; this view just forwards the click). When omitted, rows
   * are plain single-pick items that close the menu (the questionnaire's
   * one-call-at-a-time mode).
   */
  onToggle?: (dc: datacall) => void
  /**
   * Datacall id considered "latest" by the system; rendered with a "Current"
   * outlined chip inside the picker dropdown so users can spot the active
   * cycle without re-deriving it.
   */
  latestDataCallId: number
  /**
   * The data calls the dashboard is currently aggregating (the active
   * year's toggled-on calls). Drives the aggregate summary shown while no
   * single call is selected, the checkbox states, and the Opens/Closes
   * range on the right.
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
 * Pure presentational shell for the datacall context card. Owns no state
 * beyond the open menu anchor: the parent supplies the datacall list, the
 * current selection/aggregate set, and the change handlers. Keeping this
 * layer pure means it can be rendered from Storybook, dropped into snapshot
 * tests, or composed under a different data source without dragging
 * Title-context coupling along with it.
 *
 * The picker is a pill button (primary50 fill, primary text, 30px height)
 * opening a menu of calls grouped by fiscal year (newest first) and labeled
 * with their tenant (CMS quarterly / HHS ZTM). With {@link onToggle} the
 * rows carry checkboxes and support the year-grouped multi-select (#467);
 * without it a click picks that one call. While more than one call is
 * aggregated the pill shows a summary ("FY2026 - 3 calls") and the right
 * side shows the opens/closes span across those calls; the clear X returns
 * a single-call pick to that aggregated view. When {@link readOnly} is true
 * the picker collapses to a non-interactive pill of the same shape.
 * @param {DatacallContextCardViewProps} props - Component props.
 * @returns {JSX.Element | null} The card markup, or null when the datacall
 *   list is empty (so callers can mount the card unconditionally).
 */
export default function DatacallContextCardView({
  datacalls,
  selectedDatacall,
  onSelect,
  onToggle,
  latestDataCallId,
  activeDatacallIds = [],
  readOnly = false,
  clearable = true,
}: DatacallContextCardViewProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const groups = useMemo(() => groupDatacallsByYear(datacalls), [datacalls])
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

  const pillLabel =
    selectedDatacall?.datacall ?? (aggregating ? aggregateSummary : '-')
  const menuOpen = Boolean(menuAnchor)
  const closeMenu = () => setMenuAnchor(null)

  const pillSx = {
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
    boxSizing: 'border-box' as const,
  }

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
          sx={{ ...pillSx, cursor: 'default' }}
        >
          {pillLabel}
        </Box>
      ) : (
        <>
          <Box
            component="button"
            type="button"
            onClick={(e: React.MouseEvent<HTMLElement>) =>
              setMenuAnchor(e.currentTarget)
            }
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
            aria-label={
              aggregating
                ? `Select data calls (viewing ${aggregateSummary})`
                : `Select data calls (viewing ${pillLabel})`
            }
            sx={{
              ...pillSx,
              justifyContent: 'space-between',
              gap: 0.5,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              '&:hover': { backgroundColor: colors.neutral100 },
            }}
          >
            <Box component="span">{pillLabel}</Box>
            <ArrowDropDownIcon sx={{ fontSize: 20 }} />
          </Box>
          {/* Clearing a single-call pick returns to the aggregated year
              view. Hidden while already aggregating (nothing to clear) and
              on pages that view one specific call (nothing to clear TO). */}
          {clearable && selectedDatacall && (
            <IconButton
              size="small"
              aria-label="Show the whole year"
              onClick={() => onSelect(null)}
              sx={{ color: colors.primary, ml: -1 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <Menu
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={closeMenu}
            MenuListProps={{
              'aria-label': 'Data calls',
              dense: true,
              sx: { minWidth: 300 },
            }}
          >
            {groups.flatMap((group) => [
              <ListSubheader
                key={`year-${group.year ?? 'other'}`}
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: colors.neutral500,
                  lineHeight: '28px',
                }}
              >
                {group.year != null ? `FY${group.year}` : 'Other'}
              </ListSubheader>,
              ...group.calls.map((option) => {
                const isCurrent = option.datacallid === latestDataCallId
                const checked = activeDatacallIds.includes(option.datacallid)
                const closed = new Date() > new Date(option.deadline)
                const { tenant } = parseDatacallName(option.datacall)
                const deadlineLabel = new Date(
                  option.deadline
                ).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                return (
                  <MenuItem
                    key={option.datacallid}
                    dense
                    selected={!onToggle && checked}
                    onClick={() => {
                      // Multi mode toggles and stays open so several calls
                      // can be flipped in one visit; single-pick closes.
                      if (onToggle) {
                        onToggle(option)
                        return
                      }
                      onSelect(option)
                      closeMenu()
                    }}
                  >
                    {onToggle && (
                      <Checkbox
                        checked={checked}
                        readOnly
                        size="small"
                        sx={{ mr: 1, p: 0.25 }}
                      />
                    )}
                    <ListItemText
                      primary={
                        <Box
                          component="span"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                          }}
                        >
                          <Box component="span" sx={{ fontWeight: 500 }}>
                            {option.datacall}
                            {tenant !== 'Other' && (
                              <Box
                                component="span"
                                sx={{
                                  color: colors.neutral500,
                                  fontWeight: 400,
                                }}
                              >
                                {' '}
                                - {tenant}
                              </Box>
                            )}
                          </Box>
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
                      }
                      secondary={`${closed ? 'Closed' : 'Active'} · deadline ${deadlineLabel}`}
                      secondaryTypographyProps={{ fontSize: '0.75rem' }}
                    />
                  </MenuItem>
                )
              }),
            ])}
          </Menu>
        </>
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
