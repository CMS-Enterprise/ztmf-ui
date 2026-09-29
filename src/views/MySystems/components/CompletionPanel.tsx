/**
 * Per-system questionnaire progress, and what is sitting unconfirmed.
 *
 * The one figure on this page that names work nobody else can see. A new cycle
 * is seeded with last cycle's answers, so a system reads as fully answered
 * while registering nothing until someone confirms it (ztmf#659) - a full bar
 * beside "40 unconfirmed" is exactly the state that trap produces, and saying
 * it plainly is the whole reason this panel exists.
 *
 * @module views/MySystems/components/CompletionPanel
 */
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ChartCard from '@/views/OpDivDashboard/components/ChartCard'
import { questionnairePath } from '@/views/QuestionnairePage/deepLink'
import { colors, fonts, radius } from '@/theme/tokens'
import type { CompletionRow } from '../mySystemsAggregates'

/** Explains the figure in the card header. */
const COMPLETION_INFO =
  'Progress on each system you are assigned, for the data call it is shown against. While a call is open this counts answers CONFIRMED this cycle, not answers present: a new cycle starts pre-filled with last cycle’s answers, so a questionnaire can look complete and still register nothing until someone confirms it. Once a call closes there is nothing left to confirm, so it counts answers instead.'

/** Props for {@link CompletionPanel}. */
export type CompletionPanelProps = {
  rows: CompletionRow[]
}

/**
 * Renders one progress row per system, least complete first.
 * @param {CompletionPanelProps} props - The completion rows.
 * @returns {JSX.Element} The card.
 */
export default function CompletionPanel({ rows }: CompletionPanelProps) {
  const unconfirmedSystems = rows.filter((r) => r.unconfirmed > 0).length

  return (
    <ChartCard
      eyebrow="Questionnaire progress"
      info={COMPLETION_INFO}
      subtitle={
        unconfirmedSystems > 0
          ? `${unconfirmedSystems} of ${rows.length} carrying answers nobody has confirmed`
          : `${rows.length} ${rows.length === 1 ? 'system' : 'systems'} in the data call`
      }
    >
      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          None of your systems are enrolled in an open data call.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((row) => (
            <CompletionRowView key={row.system.fismasystemid} row={row} />
          ))}
        </Box>
      )}
    </ChartCard>
  )
}

/**
 * One system's progress bar and its unconfirmed remainder.
 * @param {object} props - The row.
 * @returns {JSX.Element} A list item.
 */
function CompletionRowView({ row }: { row: CompletionRow }) {
  const { system, expected, answered, updated, unconfirmed } = row
  const done = row.measuresConfirmations ? updated : answered
  const donePct = expected > 0 ? Math.min(100, (done / expected) * 100) : 0
  // Drawn as a second segment rather than a separate bar: the unconfirmed
  // answers occupy the same questionnaire as the confirmed ones, so showing
  // them as a distinct span of one track is the honest geometry.
  const unconfirmedPct =
    expected > 0 ? Math.min(100 - donePct, (unconfirmed / expected) * 100) : 0

  return (
    <Box component="li" sx={{ py: 0.6 }}>
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
          to={questionnairePath(
            system.fismasystemid,
            row.datacallid ? String(row.datacallid) : undefined
          )}
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
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 12,
            color: colors.neutral700,
            flexShrink: 0,
          }}
        >
          {done}/{expected}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          height: 6,
          mt: 0.5,
          borderRadius: `${radius.sm}px`,
          backgroundColor: colors.neutral200,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ width: `${donePct}%`, backgroundColor: colors.up }} />
        <Box
          sx={{ width: `${unconfirmedPct}%`, backgroundColor: colors.down }}
        />
      </Box>

      {/* Stated in words, not just as a colored span - the warning has to
          survive a monochrome print and a reader who cannot separate the two
          fills. */}
      {unconfirmed > 0 ? (
        <Typography sx={{ fontSize: 12, color: colors.down, mt: 0.35 }}>
          {unconfirmed} answered but not confirmed this cycle
        </Typography>
      ) : done >= expected ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
          <CheckCircleOutlineIcon
            sx={{ fontSize: 13, color: colors.up }}
            aria-hidden="true"
          />
          <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
            {row.measuresConfirmations ? 'Confirmed' : 'Answered'} in full
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 12, color: colors.neutral500, mt: 0.35 }}>
          {expected - done} left to{' '}
          {row.measuresConfirmations ? 'confirm' : 'answer'}
        </Typography>
      )}
    </Box>
  )
}
