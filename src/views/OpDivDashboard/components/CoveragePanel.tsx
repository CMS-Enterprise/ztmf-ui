/**
 * Who administers this OpDiv, and where its contact coverage is thin.
 *
 * Names people rather than counting them: "Owner 8" tells nobody who to ask,
 * which is the only question this panel exists to answer. Only admin tiers are
 * listed - an ISSO's OpDiv grant is not their scope, so including them would
 * misrepresent who covers the OpDiv - and ISSO coverage is reported from the
 * systems instead, on the right.
 *
 * Read-only by design: every delegate write requires a write-admin tier, so a
 * read-only admin viewing this would meet a 403 on any inline action. Links go
 * to the pages that own those writes instead.
 *
 * @module views/OpDivDashboard/components/CoveragePanel
 */
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { Routes } from '@/router/constants'
import { colors, fonts, radius } from '@/theme/tokens'
import { roleLabel } from '@/utils/userRoles'
import ChartCard from './ChartCard'
import ShowAllToggle from './ShowAllToggle'
import { useExpandableRows } from './useExpandableRows'
import { adminTierRoster, classifyDelegateExpiry } from '../opdivPeople'
import type { FismaSystemType, users } from '@/types'

/** How many admins to name before summarizing the remainder. */
const MAX_LISTED = 12

/** Props for {@link CoveragePanel}. */
export type CoveragePanelProps = {
  /** Users holding a grant on this OpDiv. */
  scopedUsers: users[]
  /** Systems with no ISSO email recorded. */
  missingIsso: FismaSystemType[]
  /** Systems with no data-call contact recorded. */
  missingContact: FismaSystemType[]
  /** Null in the aggregate view. */
  opdivId: number | null
  opdivCode: string
  isPending: boolean
  /** The /users load failed, so an empty roster is unknown rather than none. */
  isError?: boolean
  /** Whether the viewer can write users; read-only tiers get "View". */
  canManageUsers?: boolean
  /** Reference time for expiry, injected for deterministic tests. */
  now?: Date
}

/** How many systems to name per gap before summarizing the rest. */
const MAX_NAMED = 6

/**
 * A coverage gap: the count, then the systems themselves.
 *
 * Named and linked rather than counted. "7 systems have no ISSO email" is a
 * fact nobody can act on; the seven acronyms, each linking to its system, is
 * the same fact turned into a worklist.
 * @param {object} props - The affected systems and the copy for them.
 * @returns {JSX.Element} The gap block.
 */
function GapRow({
  systems,
  singular,
  plural,
}: {
  systems: FismaSystemType[]
  singular: string
  plural: string
}) {
  const count = systems.length
  const clear = count === 0
  const {
    listed: named,
    hidden: remaining,
    expanded,
    toggle,
    cappedAtMax,
  } = useExpandableRows(systems, MAX_NAMED)
  return (
    <Box sx={{ py: 0.4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {clear ? (
          <CheckCircleOutlineIcon
            sx={{ fontSize: 15, color: colors.up }}
            aria-hidden="true"
          />
        ) : (
          <WarningAmberOutlinedIcon
            sx={{ fontSize: 15, color: colors.down }}
            aria-hidden="true"
          />
        )}
        <Typography sx={{ fontSize: 12, color: colors.neutral700 }}>
          {count} {count === 1 ? singular : plural}
        </Typography>
      </Box>
      {named.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            pl: 2.75,
            mt: 0.25,
          }}
        >
          {named.map((system) => (
            <Link
              key={system.fismasystemid}
              component={RouterLink}
              to={`/systems/${system.fismasystemid}`}
              underline="hover"
              title={system.fismaname}
              sx={{ fontSize: 11, fontWeight: 600, color: colors.primary }}
            >
              {system.fismaacronym}
            </Link>
          ))}
          {(remaining > 0 || expanded) && (
            <ShowAllToggle
              hidden={remaining}
              expanded={expanded}
              onToggle={toggle}
              noun={`${count} ${count === 1 ? singular : plural}`}
              cappedAtMax={cappedAtMax}
              total={count}
            />
          )}
        </Box>
      )}
    </Box>
  )
}

/**
 * Renders the admin roster, delegate expiry and the contact gaps.
 * @param {CoveragePanelProps} props - Scoped users, gaps and identifiers.
 * @returns {JSX.Element} The coverage card.
 */
export default function CoveragePanel({
  scopedUsers,
  missingIsso,
  missingContact,
  opdivId,
  opdivCode,
  isPending,
  isError = false,
  canManageUsers = false,
  now,
}: CoveragePanelProps) {
  const roster = adminTierRoster(scopedUsers)
  const {
    listed,
    hidden: remaining,
    expanded: rosterOpen,
    toggle: toggleRoster,
    cappedAtMax: rosterCapped,
  } = useExpandableRows(roster, MAX_LISTED)
  const delegates = classifyDelegateExpiry(scopedUsers, now ?? new Date())
  const delegateTotal =
    delegates.active.length +
    delegates.expiringSoon.length +
    delegates.expired.length

  return (
    <ChartCard
      eyebrow="People & coverage"
      info="Admin-tier users assigned to this OpDiv, and systems missing a point of contact. ISSOs are not listed: an OpDiv grant is not their access scope, so counting them here would overstate coverage."
      subtitle={`Administrators and contact coverage for ${opdivCode}`}
      action={
        <Link
          component={RouterLink}
          to={
            opdivId === null ? Routes.USERS : `${Routes.USERS}?opdiv=${opdivId}`
          }
          underline="hover"
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.primary,
            flexShrink: 0,
          }}
        >
          {canManageUsers ? 'Manage users →' : 'View users →'}
        </Link>
      }
    >
      {isPending ? (
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          Loading people…
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            alignItems: 'start',
          }}
        >
          <Box>
            <Typography
              sx={{ fontSize: 11, color: colors.neutral500, mb: 0.75 }}
            >
              {roster.length === 0
                ? 'Administrators'
                : `${roster.length} ${
                    roster.length === 1 ? 'administrator' : 'administrators'
                  }`}
            </Typography>
            {isError ? (
              <Typography sx={{ fontSize: 13, color: colors.down }}>
                Could not load users, so administrators cannot be listed.
              </Typography>
            ) : roster.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
                No admin-tier users are assigned to this OpDiv.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                  },
                  columnGap: 2,
                }}
              >
                {listed.map((user) => (
                  <Box
                    key={user.userid}
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 1,
                      py: 0.4,
                      minWidth: 0,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.ink,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={user.email}
                      >
                        {user.fullname || user.email}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: colors.neutral500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.email}
                      </Typography>
                    </Box>
                    {/* Role rides beside the name so the list answers "who do
                        I ask" and "can they actually do it" together. */}
                    <Typography
                      sx={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 600,
                        color: colors.neutral700,
                        backgroundColor: colors.neutral100,
                        borderRadius: `${radius.sm}px`,
                        px: 0.75,
                        py: 0.25,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {roleLabel(user.role)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            {(remaining > 0 || rosterOpen) && (
              <ShowAllToggle
                hidden={remaining}
                expanded={rosterOpen}
                onToggle={toggleRoster}
                noun={`${roster.length} administrators`}
                cappedAtMax={rosterCapped}
                total={roster.length}
              />
            )}
          </Box>

          <Box>
            <Typography
              sx={{ fontSize: 11, color: colors.neutral500, mb: 0.75 }}
            >
              Coverage
            </Typography>
            <GapRow
              systems={missingIsso}
              singular="system has no ISSO email"
              plural="systems have no ISSO email"
            />
            <GapRow
              systems={missingContact}
              singular="system has no data-call contact"
              plural="systems have no data-call contact"
            />
            {delegateTotal > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography
                  sx={{ fontSize: 11, color: colors.neutral500, mb: 0.25 }}
                >
                  System delegates
                </Typography>
                <Typography
                  sx={{
                    fontSize: 12,
                    color: colors.neutral700,
                    fontFamily: fonts.base,
                  }}
                >
                  {delegates.active.length} active
                  {delegates.expiringSoon.length > 0 &&
                    ` · ${delegates.expiringSoon.length} expiring within 30 days`}
                  {delegates.expired.length > 0 &&
                    ` · ${delegates.expired.length} expired`}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </ChartCard>
  )
}
