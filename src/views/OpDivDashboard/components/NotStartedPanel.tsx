/**
 * Systems enrolled in the data call that have not been started.
 *
 * The only list on the page that maps to something someone does today: these
 * are the owners to chase. Each name links straight to that system's
 * questionnaire so the panel is a worklist, not just a count.
 *
 * @module views/OpDivDashboard/components/NotStartedPanel
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { colors, fonts } from '@/theme/tokens'
import ChartCard from './ChartCard'
import ShowAllToggle from './ShowAllToggle'
import type { NoProgressRow } from '../opdivAggregates'

/** Explains the figure in the card header. */
const NOT_STARTED_INFO =
  'Systems in the data call with nothing confirmed this cycle. Answers carried forward from last cycle do not count as progress until someone confirms them, which is why a system with a full questionnaire can still appear here.'

/** How many to name before summarizing the remainder. */
const MAX_LISTED = 8

/** Props for {@link NotStartedPanel}. */
export type NotStartedPanelProps = {
  rows: NoProgressRow[]
  /** Systems the call expects answers from, as the denominator. */
  systemsInCall: number
  /** The call the questionnaire links should open. */
  datacallId?: number
  /** Scroll anchor, for the jump from the Not started tile. */
  id?: string
}

/**
 * Renders the not-started worklist for the active data call.
 * @param {NotStartedPanelProps} props - The rows and call context.
 * @returns {JSX.Element} The card.
 */
export default function NotStartedPanel({
  rows,
  systemsInCall,
  datacallId,
  id,
}: NotStartedPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const listed = expanded ? rows : rows.slice(0, MAX_LISTED)
  const remaining = rows.length - listed.length

  return (
    <ChartCard
      id={id}
      eyebrow="Not started"
      info={NOT_STARTED_INFO}
      subtitle={
        systemsInCall > 0
          ? `${rows.length} of ${systemsInCall} with no progress this call`
          : 'No systems in the data call'
      }
    >
      {rows.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
          <CheckCircleOutlineIcon
            sx={{ fontSize: 16, color: colors.up }}
            aria-hidden="true"
          />
          <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
            {systemsInCall > 0
              ? 'Every system has progress this call.'
              : 'Nothing is expected this call.'}
          </Typography>
        </Box>
      ) : (
        <>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {listed.map(
              ({ row: { system, progress }, awaitingConfirmation }) => (
                <Box
                  component="li"
                  key={system.fismasystemid}
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 1,
                    py: 0.4,
                  }}
                >
                  {/* The name absorbs the slack rather than the row using
                      space-between: with three children that pushed the middle
                      column around by however long each acronym happened to
                      be, so nothing lined up down the list. */}
                  <Link
                    component={RouterLink}
                    // Deep-links to the system's questionnaire for this call, so
                    // the panel hands off straight into the work.
                    to={`/questionnaire/${system.fismaacronym}${
                      datacallId ? `/${datacallId}` : ''
                    }`}
                    underline="hover"
                    title={system.fismaname}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.primary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {system.fismaacronym}
                  </Link>
                  {/* The two zero-progress states are kept apart here even
                    though they count the same: a blanket "not started" reads
                    as data loss to an ISSO who has already reviewed it all.
                    Sits against the count rather than in a fixed column: the
                    text is identical on every row that has it, so the tags
                    line up without a magic width to keep in sync. */}
                  {awaitingConfirmation && (
                    <Typography
                      sx={{
                        flexShrink: 0,
                        fontSize: 10,
                        color: colors.neutral500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      awaiting confirmation
                    </Typography>
                  )}
                  {/* Names the size of the ask, so a 90-question system reads
                    differently from a 12-question one. */}
                  <Typography
                    sx={{
                      flexShrink: 0,
                      minWidth: 38,
                      textAlign: 'right',
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      fontVariantNumeric: 'tabular-nums',
                      color: colors.neutral500,
                    }}
                  >
                    0/{progress?.questionsexpected ?? 0}
                  </Typography>
                </Box>
              )
            )}
          </Box>
          {(remaining > 0 || expanded) && (
            <ShowAllToggle
              hidden={remaining}
              expanded={expanded}
              onToggle={() => setExpanded((open) => !open)}
              noun={`${rows.length} not started`}
            />
          )}
        </>
      )}
    </ChartCard>
  )
}
