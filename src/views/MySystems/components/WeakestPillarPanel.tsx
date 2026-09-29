/**
 * The pillar dragging each system down.
 *
 * The pillar averages card says where this scope stands overall; this says
 * where each system is actually losing points, which is the form that turns
 * into a next action. A bar per system rather than per pillar, because with a
 * handful of systems the question is "which of mine, and on what" rather than
 * "which pillar across the estate".
 *
 * @module views/MySystems/components/WeakestPillarPanel
 */
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import ChartCard from '@/views/OpDivDashboard/components/ChartCard'
import { colors, fonts } from '@/theme/tokens'
import { tierForScore } from '@/utils/tierStyles'
import { tierDot } from '@/theme/tokens'
import type { SystemWeakPillar } from '../mySystemsAggregates'

/** Explains the figure in the card header. */
const WEAKEST_INFO =
  'For each system, the pillar it scores lowest on, and how far that sits below the system’s own average across the pillars it is scored on. A system scored on fewer pillars (a SaaS system is scored on four, not six) is averaged over only the pillars it carries, so the gap is never inflated by pillars that do not apply to it.'

/** Scale bounds, matching the maturity scale. */
const MIN_SCORE = 1
const MAX_SCORE = 5

/** Props for {@link WeakestPillarPanel}. */
export type WeakestPillarPanelProps = {
  rows: SystemWeakPillar[]
  /** The call the pillar detail describes. */
  callName?: string
}

/**
 * Renders each system's weakest pillar, lowest score first.
 * @param {WeakestPillarPanelProps} props - The rows and the call name.
 * @returns {JSX.Element} The card.
 */
export default function WeakestPillarPanel({
  rows,
  callName,
}: WeakestPillarPanelProps) {
  return (
    <ChartCard
      eyebrow="Weakest pillar"
      info={WEAKEST_INFO}
      subtitle={callName ? `Per system · ${callName}` : 'Per system'}
    >
      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          No pillar detail has been scored for these systems yet.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map(({ system, pillar, score, belowOwnAverage }) => {
            // Measured from 1.0, not 0: the scale floor is 1.0, so measuring
            // from zero would render the worst possible score as a fifth-full
            // bar and squeeze the real spread into the rest.
            const pct = ((score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * 100
            return (
              <Box component="li" key={system.fismasystemid} sx={{ py: 0.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Link
                    component={RouterLink}
                    to={`/systems/${system.fismasystemid}/pillar-scores`}
                    underline="hover"
                    title={`${system.fismaname} · pillar scores`}
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
                  {/* Pillar name as text, so identity never rests on the bar
                      color alone. */}
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: colors.neutral700,
                      flexShrink: 0,
                    }}
                  >
                    {pillar}{' '}
                    <Box
                      component="span"
                      sx={{ fontFamily: fonts.mono, color: colors.ink }}
                    >
                      {score.toFixed(2)}
                    </Box>
                  </Typography>
                </Box>
                <Box
                  sx={{
                    height: 6,
                    mt: 0.5,
                    borderRadius: 3,
                    backgroundColor: colors.neutral200,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${Math.max(0, Math.min(100, pct))}%`,
                      height: '100%',
                      backgroundColor: tierDot[tierForScore(score)],
                    }}
                  />
                </Box>
                {belowOwnAverage >= 0.005 && (
                  <Typography
                    sx={{ fontSize: 12, color: colors.neutral500, mt: 0.35 }}
                  >
                    {belowOwnAverage.toFixed(2)} below this system’s average
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </ChartCard>
  )
}
