/**
 * Systems with no target maturity asserted.
 *
 * On the OpDiv dashboard the target figure is structurally empty and will stay
 * that way until ISSOs set targets - which is exactly why it belongs here
 * instead. This is the one panel whose backlog its reader can personally clear:
 * ISSO and ISSM are the tiers the backend lets set a target, so the list is a
 * worklist rather than a statistic.
 *
 * Withheld from System Delegates, who are answers-only - see MySystemsBand.
 *
 * @module views/MySystems/components/TargetPanel
 */
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ChartCard from '@/views/OpDivDashboard/components/ChartCard'
import { useExpandableRows } from '@/views/OpDivDashboard/components/useExpandableRows'
import ShowAllToggle from '@/views/OpDivDashboard/components/ShowAllToggle'
import { colors, fonts } from '@/theme/tokens'
import type { OpDivSystemRow } from '@/views/OpDivDashboard/opdivAggregates'

/** Explains the figure in the card header. */
const TARGET_INFO =
  'The risk-based maturity tier a system is aiming for. A system with none recorded is an unanswered question rather than a failing one - nothing scores it down - but without a target there is nothing to measure its progress against. You can set one from the system’s detail page.'

/** How many to name before summarizing the remainder. */
const MAX_LISTED = 8

/** Props for {@link TargetPanel}. */
export type TargetPanelProps = {
  /** Systems carrying no asserted target. */
  rows: OpDivSystemRow[]
  /** Systems in scope, as the denominator. */
  totalSystems: number
}

/**
 * Renders the systems still needing a target maturity.
 * @param {TargetPanelProps} props - The rows and the denominator.
 * @returns {JSX.Element} The card.
 */
export default function TargetPanel({ rows, totalSystems }: TargetPanelProps) {
  const {
    listed,
    hidden: remaining,
    expanded,
    toggle,
    cappedAtMax,
  } = useExpandableRows(rows, MAX_LISTED)

  return (
    <ChartCard
      eyebrow="Target maturity"
      info={TARGET_INFO}
      subtitle={
        rows.length > 0
          ? `${rows.length} of ${totalSystems} with no target set`
          : 'Every system has a target'
      }
    >
      {rows.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
          <CheckCircleOutlineIcon
            sx={{ fontSize: 16, color: colors.up }}
            aria-hidden="true"
          />
          <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
            {totalSystems > 0
              ? 'Every system you hold has a target maturity.'
              : 'No systems in scope.'}
          </Typography>
        </Box>
      ) : (
        <>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {listed.map(({ system, tier }) => (
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
                {/* Prefixed "now", because an unprefixed tier under a "no
                    target set" heading reads as the target itself - which is
                    the opposite of what this row is saying. */}
                <Typography
                  sx={{
                    fontSize: 12,
                    color: colors.neutral500,
                    flexShrink: 0,
                  }}
                >
                  {tier ? (
                    <>
                      now{' '}
                      <Box component="span" sx={{ fontFamily: fonts.mono }}>
                        {tier}
                      </Box>
                    </>
                  ) : (
                    'not scored'
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
          {(remaining > 0 || expanded) && (
            <ShowAllToggle
              hidden={remaining}
              expanded={expanded}
              onToggle={toggle}
              noun={`${rows.length} without a target`}
              cappedAtMax={cappedAtMax}
              total={rows.length}
            />
          )}
        </>
      )}
    </ChartCard>
  )
}
