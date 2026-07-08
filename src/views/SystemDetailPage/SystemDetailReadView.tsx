import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { FismaSystemType, OpDiv, ScoreAggregate, ScoreTier } from '@/types'
import { colors, fonts, radius, tierDot } from '@/theme/tokens'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'
import { PILLAR_ORDER } from '@/constants'
import { CodeBadge } from '@/components/ui/StatusChip'
import CfactsRecordCard from './CfactsRecordCard'
import InsightsEmptyState from './InsightsEmptyState'
import { getFieldsBySection } from './fieldConfig'

/**
 * Highest possible zero trust score on the user-facing scale, used to
 * normalize the pillar snapshot bars. The backend computes scores on a
 * 1.0-5.0 scale via the +1 shift at aggregation
 * (backend/internal/model/scores.go).
 */
const MAX_SCORE = 5

/**
 * Props for {@link SystemDetailReadView}.
 */
interface SystemDetailReadViewProps {
  /** The system being displayed. */
  system: FismaSystemType
  /** OpDiv reference list, used to resolve the system's OpDiv code. */
  opdivs: OpDiv[]
  /** Score aggregate for the current datacall, when available. */
  currentScore?: ScoreAggregate
  /** Score aggregate for the prior datacall on the same system, when available. */
  previousScore?: ScoreAggregate
  /** Human-readable name for the previous datacall, used in the trend line. */
  previousDatacallName?: string
}

/**
 * Read-mode view for the System detail page. Renders the score hero (overall
 * + pillar snapshot), the System identity and Organization detail cards, and
 * the ZTMF Insights section (CfactsRecordCard when sdl_sync is on, the new
 * EmptyState otherwise).
 * @param {SystemDetailReadViewProps} props - System, OpDivs and score aggregates.
 * @returns {JSX.Element} The detail page body.
 */
export default function SystemDetailReadView({
  system,
  opdivs,
  currentScore,
  previousScore,
  previousDatacallName,
}: SystemDetailReadViewProps) {
  const opdivCode = opdivs.find((od) => od.opdiv_id === system.opdiv_id)?.code
  const extendedFields = getFieldsBySection('extended')
  // Only show the Extended Metadata card when at least one field is
  // populated. Systems without extended metadata have every field null and
  // would otherwise render an empty card. (Read view is not role-gated; the
  // values are the system's own metadata, visible to anyone who can view
  // the system.)
  const hasAnyExtendedData = extendedFields.some(
    (field) => system[field.key] != null && system[field.key] !== ''
  )

  return (
    <Box>
      <ScoreHero
        currentScore={currentScore}
        previousScore={previousScore}
        previousDatacallName={previousDatacallName}
        systemId={system.fismasystemid}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 1.75,
          mb: 1.75,
        }}
      >
        <DetailCard
          title="System identity"
          rows={[
            {
              label: 'FISMA UID',
              value: <Mono>{system.fismauid || '-'}</Mono>,
            },
            { label: 'Acronym', value: system.fismaacronym || '-' },
            { label: 'Subsystem', value: system.fismasubsystem || '-' },
            { label: 'Component', value: system.component || '-' },
            {
              label: 'Data center',
              value: system.datacenterenvironment || '-',
            },
            {
              label: 'FIPS-199 impact',
              value: system.fismaimpactlevel || '-',
            },
          ]}
        />
        <DetailCard
          title="Organization"
          rows={[
            {
              label: 'OpDiv',
              value: opdivCode ? <CodeBadge code={opdivCode} /> : '-',
            },
            { label: 'Group acronym', value: system.groupacronym || '-' },
            { label: 'Group name', value: system.groupname || '-' },
            { label: 'Division name', value: system.divisionname || '-' },
            { label: 'ISSO email', value: system.issoemail || '-' },
            {
              label: 'Data call contact',
              value: system.datacallcontact || '-',
            },
          ]}
        />
      </Box>
      {hasAnyExtendedData && (
        <Box sx={{ mb: 1.75 }}>
          <DetailCard
            title="Extended metadata"
            rows={extendedFields.map((field) => ({
              label: field.label,
              value: String(system[field.key] ?? '') || '-',
            }))}
          />
        </Box>
      )}
      <InsightsSection system={system} />
    </Box>
  )
}

/**
 * Score hero card. Two-column split: overall score + tier + trend + pillar
 * breakdown link on the left, pillar snapshot grid on the right.
 */
function ScoreHero({
  currentScore,
  previousScore,
  previousDatacallName,
  systemId,
}: {
  currentScore?: ScoreAggregate
  previousScore?: ScoreAggregate
  previousDatacallName?: string
  systemId: number
}) {
  const navigate = useNavigate()
  // Render the card even when no score is available so the page shape stays
  // consistent and the empty state is informative.
  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.5,
        mb: 1.75,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' },
        gap: 3,
      }}
    >
      <Box
        sx={{
          borderRight: { xs: 'none', md: `1px solid ${colors.neutral200}` },
          borderBottom: {
            xs: `1px solid ${colors.neutral200}`,
            md: 'none',
          },
          pr: { xs: 0, md: 3 },
          pb: { xs: 2, md: 0 },
        }}
      >
        {/* Datacall name lives in the chrome sub-bar (Title.tsx) now, so
            the eyebrow stops at "Zero trust score" to avoid duplicate
            context. The currentDatacallName prop is still passed down for
            the trend-line label below ("was 3.52 in <prev datacall>"). */}
        <Eyebrow>Zero trust score</Eyebrow>
        {currentScore ? (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1.25,
                mt: 1,
                mb: 0.5,
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontFamily: fonts.mono,
                  fontSize: 48,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: colors.ink,
                }}
              >
                {currentScore.systemscore.toFixed(2)}
              </Typography>
              <TierLabel tier={currentScore.systemtier} />
            </Box>
            <TrendLine
              current={currentScore.systemscore}
              previous={previousScore?.systemscore}
              previousDatacallName={previousDatacallName}
            />
          </>
        ) : (
          <Typography
            sx={{
              mt: 1,
              fontSize: 14,
              fontWeight: 500,
              color: colors.neutral500,
            }}
          >
            No score available yet.
          </Typography>
        )}
        <Box sx={{ mt: 1.75 }}>
          <Button
            onClick={() => navigate(`/systems/${systemId}/pillar-scores`)}
            sx={{
              p: 0,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 600,
              color: colors.primary,
              textTransform: 'none',
              '&:hover': { backgroundColor: 'transparent' },
            }}
            endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
          >
            View pillar breakdown
          </Button>
        </Box>
      </Box>
      <Box>
        <Eyebrow>Pillar snapshot</Eyebrow>
        <PillarSnapshot pillars={currentScore?.pillarscores} />
      </Box>
    </Box>
  )
}

/**
 * Two-column grid of pillar rows (name + bar + score). Falls back to a muted
 * single line when no pillar data is available yet.
 */
function PillarSnapshot({
  pillars,
}: {
  pillars?: {
    pillarid: number
    pillar: string
    score: number
    tier?: ScoreTier
  }[]
}) {
  if (!pillars || pillars.length === 0) {
    return (
      <Typography sx={{ mt: 1, fontSize: 13, color: colors.neutral500 }}>
        Pillar scores appear once the datacall has been scored.
      </Typography>
    )
  }
  const rank = (name: string) => {
    const i = PILLAR_ORDER.indexOf(name)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const sorted = [...pillars].sort((a, b) => rank(a.pillar) - rank(b.pillar))
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        gap: '8px 18px',
        mt: 1.25,
      }}
    >
      {sorted.map((p) => (
        <PillarRow key={p.pillarid} pillar={p} />
      ))}
    </Box>
  )
}

function PillarRow({
  pillar,
}: {
  pillar: { pillarid: number; pillar: string; score: number; tier?: ScoreTier }
}) {
  const tier: ScoreTier = pillar.tier ?? 'Not Assessed'
  const notAssessed = tier === 'Not Assessed'
  const fillPct = Math.max(0, Math.min(1, pillar.score / MAX_SCORE)) * 100
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ flex: 1, fontSize: 13, fontWeight: 500, color: colors.ink }}>
        {pillar.pillar}
      </Box>
      <Box
        sx={{
          width: 80,
          height: 5,
          borderRadius: `${radius.sm}px`,
          backgroundColor: colors.neutral200,
          overflow: 'hidden',
        }}
      >
        {!notAssessed && (
          <Box
            sx={{
              width: `${fillPct}%`,
              height: '100%',
              borderRadius: `${radius.sm}px`,
              backgroundColor: tierDot[tier],
            }}
          />
        )}
      </Box>
      <Typography
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: 13,
          fontWeight: 600,
          color: colors.ink,
          minWidth: 32,
          textAlign: 'right',
        }}
      >
        {notAssessed ? '-' : pillar.score.toFixed(2)}
      </Typography>
    </Box>
  )
}

/**
 * Renders the trend delta line under the overall score: up/down arrow icon,
 * delta value, and the previous datacall reference. Falls back to a muted
 * "no prior measurement" line so the area stays balanced.
 */
function TrendLine({
  current,
  previous,
  previousDatacallName,
}: {
  current: number
  previous?: number
  previousDatacallName?: string
}) {
  if (typeof previous !== 'number') {
    return (
      <Typography
        sx={{ fontSize: 13, fontWeight: 500, color: colors.neutral500 }}
      >
        First measurement, no prior period to compare against.
      </Typography>
    )
  }
  const delta = current - previous
  const flat = Math.abs(delta) < 0.005
  const up = delta > 0
  const color = flat ? colors.neutral500 : up ? colors.up : colors.down
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        color,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {!flat &&
        (up ? (
          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
        ) : (
          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
        ))}
      <span>
        {flat ? 'No change' : `${up ? '+' : ''}${delta.toFixed(2)}`}
        {previousDatacallName ? ` vs ${previousDatacallName}` : ''}
        {` (was ${previous.toFixed(2)})`}
      </span>
    </Box>
  )
}

/**
 * Two-column key/value card used for System identity and Organization.
 */
function DetailCard({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: ReactNode }[]
}) {
  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.25,
      }}
    >
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 700,
          color: colors.ink,
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '130px 1fr',
          gap: '8px 14px',
          fontSize: 13,
        }}
      >
        {rows.map((row) => (
          <Box key={row.label} sx={{ display: 'contents' }}>
            <Box sx={{ color: colors.neutral500, fontWeight: 500 }}>
              {row.label}
            </Box>
            <Box sx={{ color: colors.ink, fontWeight: 500 }}>{row.value}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/**
 * ZTMF Insights section. Always renders a card with the "ZTMF Insights" title
 * so the section is consistent; inside, either the CfactsRecordCard content
 * (when sdl_sync is on and the upstream returns data) or the insights empty
 * state (when sdl_sync is off, or on but the upstream has no record).
 */
function InsightsSection({ system }: { system: FismaSystemType }) {
  const body =
    system.fismauid && system.sdl_sync_enabled ? (
      <CfactsRecordCard fismaUid={system.fismauid} />
    ) : (
      <InsightsEmptyState />
    )
  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.25,
      }}
    >
      <Typography
        sx={{ fontSize: 14, fontWeight: 700, color: colors.ink, mb: 1.5 }}
      >
        ZTMF Insights
      </Typography>
      {body}
    </Box>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 11,
        fontWeight: 600,
        color: colors.neutral500,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </Typography>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{ fontFamily: fonts.mono, fontSize: 13, fontWeight: 500 }}
    >
      {children}
    </Box>
  )
}

function TierLabel({ tier }: { tier?: ScoreTier }) {
  if (!tier || tier === 'Not Assessed') {
    return (
      <Typography
        component="span"
        sx={{ fontSize: 14, fontWeight: 600, color: colors.neutral500 }}
      >
        Not assessed
      </Typography>
    )
  }
  const color = TIER_CHIP_STYLES[tier].color
  return (
    <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color }}>
      {tier}
    </Typography>
  )
}
