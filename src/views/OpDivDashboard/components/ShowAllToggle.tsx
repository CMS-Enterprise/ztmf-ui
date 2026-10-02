/**
 * The control that opens a truncated panel list.
 *
 * Every worklist here caps how many systems it names, which kept the cards a
 * readable height but ended them on a dead sentence: "and 14 more not
 * started." is precisely the point at which someone wants the other fourteen,
 * and the panel's whole purpose is to hand off into the work.
 *
 * Expanding in place rather than linking elsewhere, because the rows are
 * already on the client and each one already links to its system - sending the
 * reader to a filtered table would cost a page load to reach links they were
 * one click from.
 *
 * Expanding stops at MAX_EXPANDED. At the start of a data call the not-started
 * list holds every enrolled system, which at CMS scale is four figures, and a
 * thousand rows in a card is neither readable nor worth the DOM. Past the
 * ceiling the control says what is still unnamed and points at the table.
 *
 * @module views/OpDivDashboard/components/ShowAllToggle
 */
import ButtonBase from '@mui/material/ButtonBase'
import Box from '@mui/material/Box'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'
import { MAX_EXPANDED } from './useExpandableRows'

/** Props for {@link ShowAllToggle}. */
export type ShowAllToggleProps = {
  /** How many rows are hidden while collapsed. */
  hidden: number
  expanded: boolean
  onToggle: () => void
  /**
   * What the hidden rows are, for the collapsed label and the accessible
   * name - "14 more not started" says more than "14 more".
   */
  noun: string
  /** True when even the expanded list is truncated - see MAX_EXPANDED. */
  cappedAtMax?: boolean
  /** Total rows, for the note shown when the expanded list is still capped. */
  total?: number
}

/**
 * Renders the show-all / show-fewer control for a capped list.
 * @param {ShowAllToggleProps} props - Hidden count, state and label.
 * @returns {JSX.Element} The toggle.
 */
export default function ShowAllToggle({
  hidden,
  expanded,
  onToggle,
  noun,
  cappedAtMax = false,
  total,
}: ShowAllToggleProps) {
  return (
    <>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={expanded}
        sx={{
          mt: 0.5,
          px: 0.5,
          py: 0.25,
          gap: 0.25,
          alignSelf: 'flex-start',
          borderRadius: 1,
          fontSize: 12,
          fontWeight: 600,
          color: colors.primary,
          '&:hover': { backgroundColor: colors.neutral50 },
        }}
      >
        {expanded ? `Show fewer` : `Show all ${noun}`}
        <Box
          component={expanded ? ExpandLessIcon : ExpandMoreIcon}
          aria-hidden="true"
          sx={{ fontSize: 16 }}
        />
        {/* The collapsed count is part of the button's name, so a screen reader
            hears what opening it will reveal rather than a bare "show all". */}
        {!expanded && (
          <Box
            component="span"
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
          >
            {`, ${hidden} more hidden`}
          </Box>
        )}
      </ButtonBase>
      {/* Says what the ceiling left out rather than trailing off at fifty as
          though that were the whole list. */}
      {cappedAtMax && hidden > 0 && (
        <Typography sx={{ fontSize: 11, color: colors.neutral500, mt: 0.25 }}>
          Showing {MAX_EXPANDED} of {(total ?? 0).toLocaleString('en-US')} — use
          the systems table to find a specific system.
        </Typography>
      )}
    </>
  )
}
