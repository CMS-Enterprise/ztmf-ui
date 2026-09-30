/**
 * How each system moved against the prior data call.
 *
 * The OpDiv page reports movement as two counts and a top-three list, which is
 * the right shape for hundreds of systems. With a handful, every system fits -
 * and "nothing moved" is a real answer rather than an empty list, so held
 * systems are named too.
 *
 * Regressions lead: a system that lost ground is the only entry here that asks
 * for a response.
 *
 * @module views/MySystems/components/MovementPanel
 */
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import RemoveIcon from '@mui/icons-material/Remove'
import ChartCard from '@/views/OpDivDashboard/components/ChartCard'
import { useExpandableRows } from '@/views/OpDivDashboard/components/useExpandableRows'
import ShowAllToggle from '@/views/OpDivDashboard/components/ShowAllToggle'
import { colors, fonts } from '@/theme/tokens'
import type { MovementDirection, SystemMovement } from '../mySystemsAggregates'

/** Explains the figure in the card header. */
const MOVEMENT_INFO =
  'Each system’s score against the previous data call, paired system by system. A system scored in only one of the two calls has no movement to report and is listed as "not compared" rather than counted as a change - otherwise a system joining or leaving the cycle would read as progress.'

/** Icon, color and screen-reader word per direction. */
const DIRECTIONS: Record<
  MovementDirection,
  { color: string; word: string; Icon: typeof ArrowUpwardIcon | null }
> = {
  lost: { color: colors.down, word: 'declined', Icon: ArrowDownwardIcon },
  gained: { color: colors.up, word: 'improved', Icon: ArrowUpwardIcon },
  held: { color: colors.neutral500, word: 'unchanged', Icon: RemoveIcon },
  unpaired: { color: colors.neutral500, word: 'not compared', Icon: null },
}

/** How many systems to show before the reader asks for more. */
const MAX_LISTED = 8

/** Props for {@link MovementPanel}. */
export type MovementPanelProps = {
  rows: SystemMovement[]
  /** The baseline call's name, for the scope note. */
  priorLabel?: string
}

/**
 * Renders per-system movement, regressions first.
 * @param {MovementPanelProps} props - The movement rows and baseline label.
 * @returns {JSX.Element} The card.
 */
export default function MovementPanel({
  rows,
  priorLabel,
}: MovementPanelProps) {
  const declined = rows.filter((r) => r.direction === 'lost').length
  const { listed, hidden, expanded, toggle, cappedAtMax } = useExpandableRows(
    rows,
    MAX_LISTED
  )

  return (
    <ChartCard
      eyebrow="Movement"
      info={MOVEMENT_INFO}
      subtitle={
        priorLabel
          ? declined > 0
            ? `${declined} down since ${priorLabel}`
            : `vs ${priorLabel}`
          : 'No earlier call to compare'
      }
    >
      {rows.length === 0 || !priorLabel ? (
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          There is no earlier data call to compare these systems against.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {listed.map(({ system, from, to, delta, direction }) => {
            const { color, word, Icon } = DIRECTIONS[direction]
            return (
              <Box
                component="li"
                key={system.fismasystemid}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 1,
                  py: 0.4,
                }}
              >
                <Link
                  component={RouterLink}
                  to={`/systems/${system.fismasystemid}`}
                  underline="hover"
                  title={system.fismaname}
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: colors.ink,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {system.fismaacronym}
                </Link>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexShrink: 0,
                  }}
                >
                  {/* The arrow is decorative; the direction is carried in the
                      visually-hidden word beside it, so the row still reads
                      correctly without color or iconography. */}
                  {Icon && (
                    <Icon sx={{ fontSize: 13, color }} aria-hidden="true" />
                  )}
                  <Typography
                    component="span"
                    sx={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {word}
                  </Typography>
                  <Typography
                    sx={{ fontFamily: fonts.mono, fontSize: 12, color }}
                  >
                    {delta === null
                      ? '—'
                      : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: fonts.mono,
                      fontSize: 12,
                      color: colors.neutral500,
                    }}
                  >
                    {from !== null && to !== null
                      ? `${from.toFixed(2)} → ${to.toFixed(2)}`
                      : to !== null
                        ? `now ${to.toFixed(2)}`
                        : 'not scored'}
                  </Typography>
                </Box>
              </Box>
            )
          })}
          {(hidden > 0 || expanded) && (
            <ShowAllToggle
              hidden={hidden}
              expanded={expanded}
              onToggle={toggle}
              noun={`${rows.length} systems`}
              cappedAtMax={cappedAtMax}
              total={rows.length}
            />
          )}
        </Box>
      )}
    </ChartCard>
  )
}
