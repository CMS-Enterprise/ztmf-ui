import { useState, useEffect, useMemo } from 'react'
import {
  Autocomplete,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import axiosInstance from '@/axiosConfig'
import type { ScoreAggregate, ScoreTier } from '@/types'
import { TIER_CHIP_STYLES } from '@/utils/tierStyles'
import { isAuthHandled } from '@/utils/notify'
import { colors, fonts, radius, tierDot } from '@/theme/tokens'
import { PILLAR_ORDER } from '@/constants'

/** Highest possible zero trust score; used to normalize progress bars. */
const MAX_SCORE = 4

/** All tier strings in display order, for the breakdown filter dropdown. */
const TIER_OPTIONS: ScoreTier[] = [
  'Optimal',
  'Advanced',
  'Initial',
  'Traditional',
  'Not Assessed',
]

/** Shape returned by /scores?datacallid=...&fismasystemid=...&include=functionoption. */
interface QuestionScore {
  scoreid?: number
  questionid: number
  question?: string
  function?: { functionid: number; function: string; pillar?: string }
  pillar?: string
  option?: { score?: number; tier?: ScoreTier }
  score?: number
  tier?: ScoreTier
}

/** Props for {@link PillarScoresContent}. */
export interface PillarScoresContentProps {
  /** Score aggregates for the system across one or more datacalls. */
  scores: ScoreAggregate[]
  /** The datacall to show as the current period. */
  selectedDataCallId: number
  /** Stable system id, for the question-level breakdown fetch. */
  fismasystemid: number
  /** Human-readable name of the current datacall, shown under stats. */
  currentDatacallName?: string
  /** Human-readable name of the previous datacall, used in the trend line. */
  previousDatacallName?: string
}

/**
 * Rewritten Pillar Scores view: two-card hero (overall + trend radar), pillar
 * grid with bars + trends, and a filterable question-level breakdown table.
 *
 * Three deliberate omissions vs the visual mock, each driven by the locked plan:
 *  - the "Comparison vs OpDiv average" radar is replaced with this system's
 *    "Current vs Previous" history radar (no OpDiv-average endpoint exists
 *    and the audit forbids fabricated comparators);
 *  - the per-question "Δ FY22" column is dropped (the plan locks "no
 *    per-question delta columns");
 *  - the "Cross-cutting" stat in the hero is omitted (ambiguous semantics,
 *    no single answer the design clarifies).
 * @param {PillarScoresContentProps} props - Aggregates, current datacall id,
 *   system id, and the datacall name labels for the hero.
 * @returns {JSX.Element} The pillar scores content block.
 */
export default function PillarScoresContent({
  scores,
  selectedDataCallId,
  fismasystemid,
  currentDatacallName,
  previousDatacallName,
}: PillarScoresContentProps) {
  // Latest score = the selected datacall if it has data, otherwise the highest
  // datacallid in the set. Lets the page still render the most recent
  // measurement when no datacall is picked yet.
  const latestScore =
    scores.length > 0
      ? scores.find((s) => s.datacallid === selectedDataCallId) ??
        scores.reduce((latest, current) =>
          current.datacallid > latest.datacallid ? current : latest
        )
      : null

  const previousScore = useMemo(() => {
    if (!latestScore) return undefined
    return scores
      .filter((s) => s.datacallid < latestScore.datacallid)
      .sort((a, b) => b.datacallid - a.datacallid)[0]
  }, [scores, latestScore])

  const hasValidData = Boolean(
    latestScore &&
      latestScore.pillarscores &&
      latestScore.pillarscores.length > 0
  )

  if (!latestScore || !hasValidData) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography
          sx={{ fontSize: 15, fontWeight: 700, color: colors.ink, mb: 1 }}
        >
          No score data available
        </Typography>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          This system does not have any scoring data yet. Check back after the
          next datacall closes.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <HeroRow
        latestScore={latestScore}
        previousScore={previousScore}
        currentDatacallName={currentDatacallName}
        previousDatacallName={previousDatacallName}
        scores={scores}
      />
      <PillarGrid latestScore={latestScore} previousScore={previousScore} />
      <QuestionBreakdown
        fismasystemid={fismasystemid}
        datacallid={latestScore.datacallid}
      />
    </Box>
  )
}

/**
 * Two-card hero: overall score with stats on the left, trend radar on the right.
 */
function HeroRow({
  latestScore,
  previousScore,
  currentDatacallName,
  previousDatacallName,
  scores,
}: {
  latestScore: ScoreAggregate
  previousScore?: ScoreAggregate
  currentDatacallName?: string
  previousDatacallName?: string
  scores: ScoreAggregate[]
}) {
  const trending = trendDirection(
    latestScore.systemscore,
    previousScore?.systemscore
  )
  const pillarsAtOptimal = (latestScore.pillarscores ?? []).filter(
    (p) => p.tier === 'Optimal'
  ).length
  const totalPillars = latestScore.pillarscores?.length ?? 0
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 1.75,
        mb: 1.75,
      }}
    >
      <Card>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Eyebrow>Overall ZT score</Eyebrow>
          {trending && <TrendingPill direction={trending} />}
        </Box>
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
            {latestScore.systemscore.toFixed(2)}
          </Typography>
          <TierLabel tier={latestScore.systemtier} />
        </Box>
        <TrendLine
          current={latestScore.systemscore}
          previous={previousScore?.systemscore}
          previousDatacallName={previousDatacallName}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, 1fr)' },
            gap: 2,
            mt: 2.5,
            pt: 2,
            borderTop: `1px solid ${colors.neutral200}`,
          }}
        >
          <Stat
            label="Pillars at Optimal"
            value={`${pillarsAtOptimal} / ${totalPillars || '-'}`}
          />
          <Stat
            label="Datacall"
            value={currentDatacallName ?? `Datacall ${latestScore.datacallid}`}
            mono={false}
          />
        </Box>
      </Card>
      <Card>
        <Eyebrow>Trend vs previous</Eyebrow>
        <TrendRadar scores={scores} latestScore={latestScore} />
      </Card>
    </Box>
  )
}

/**
 * Six pillar tiles in a 3-column grid. Each tile has the pillar name, tier
 * chip, large score, trend line and a full-width tier-colored progress bar.
 */
function PillarGrid({
  latestScore,
  previousScore,
}: {
  latestScore: ScoreAggregate
  previousScore?: ScoreAggregate
}) {
  const sorted = useMemo(() => {
    const list = latestScore.pillarscores ?? []
    return [...list].sort((a, b) => pillarRank(a.pillar) - pillarRank(b.pillar))
  }, [latestScore])
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        },
        gap: 1.75,
        mb: 1.75,
      }}
    >
      {sorted.map((p) => {
        const prev = previousScore?.pillarscores?.find(
          (pp) => pp.pillarid === p.pillarid
        )?.score
        const tier: ScoreTier = p.tier ?? 'Not Assessed'
        const notAssessed = tier === 'Not Assessed'
        const fillPct =
          Math.max(0, Math.min(1, (p.score ?? 0) / MAX_SCORE)) * 100
        return (
          <Card key={p.pillarid} sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
              }}
            >
              <Typography
                sx={{ fontSize: 14, fontWeight: 700, color: colors.ink }}
              >
                {p.pillar}
              </Typography>
              <TierChip tier={tier} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography
                component="span"
                sx={{
                  fontFamily: fonts.mono,
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: colors.ink,
                }}
              >
                {notAssessed ? '-' : (p.score ?? 0).toFixed(2)}
              </Typography>
              <CompactTrend current={p.score ?? 0} previous={prev} />
            </Box>
            <Box
              sx={{
                mt: 1.25,
                width: '100%',
                height: 6,
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
          </Card>
        )
      })}
    </Box>
  )
}

/**
 * Per-question table with pillar + tier filters. Fetches the same per-question
 * scores endpoint the Questionnaire page uses, then filters client-side so the
 * filter dropdowns feel instant.
 */
function QuestionBreakdown({
  fismasystemid,
  datacallid,
}: {
  fismasystemid: number
  datacallid: number
}) {
  const [rows, setRows] = useState<QuestionScore[]>([])
  const [loading, setLoading] = useState(true)
  const [pillarFilter, setPillarFilter] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<ScoreTier | null>(null)

  useEffect(() => {
    if (!fismasystemid || !datacallid) return
    const controller = new AbortController()
    setLoading(true)
    async function load() {
      try {
        const res = await axiosInstance.get(
          `scores?datacallid=${datacallid}&fismasystemid=${fismasystemid}&include=functionoption`,
          { signal: controller.signal }
        )
        setRows(res.data?.data ?? [])
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Failed to load question breakdown', error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => {
      controller.abort()
    }
  }, [fismasystemid, datacallid])

  const pillarOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const p = r.pillar ?? r.function?.pillar
      if (p) set.add(p)
    }
    return Array.from(set).sort((a, b) => pillarRank(a) - pillarRank(b))
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const p = r.pillar ?? r.function?.pillar
      const t = r.tier ?? r.option?.tier
      if (pillarFilter && p !== pillarFilter) return false
      if (tierFilter && t !== tierFilter) return false
      return true
    })
  }, [rows, pillarFilter, tierFilter])

  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 2.25,
          py: 1.75,
          borderBottom: `1px solid ${colors.neutral200}`,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: colors.ink }}>
            Question-level breakdown
          </Typography>
          <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
            {loading ? 'Loading...' : `${rows.length} questions`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FilterAutocomplete
            options={pillarOptions}
            value={pillarFilter}
            onChange={setPillarFilter}
            placeholder="All pillars"
            ariaLabel="Filter by pillar"
          />
          <FilterAutocomplete
            options={TIER_OPTIONS}
            value={tierFilter}
            onChange={(v) => setTierFilter(v as ScoreTier | null)}
            placeholder="All tiers"
            ariaLabel="Filter by tier"
          />
        </Box>
      </Box>
      {filtered.length === 0 && !loading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
            No questions match the current filters.
          </Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <BreakdownHeadCell sx={{ width: 220 }}>
                Pillar · Function
              </BreakdownHeadCell>
              <BreakdownHeadCell>Question</BreakdownHeadCell>
              <BreakdownHeadCell align="right" sx={{ width: 200 }}>
                Score
              </BreakdownHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r, idx) => {
              const pillar = r.pillar ?? r.function?.pillar ?? '-'
              const fn = r.function?.function ?? ''
              const score = r.score ?? r.option?.score
              const tier: ScoreTier = (r.tier ??
                r.option?.tier ??
                'Not Assessed') as ScoreTier
              return (
                <TableRow key={r.scoreid ?? `${r.questionid}-${idx}`}>
                  <TableCell sx={breakdownCellSx}>
                    <Typography
                      sx={{ fontSize: 13, fontWeight: 600, color: colors.ink }}
                    >
                      {pillar}
                    </Typography>
                    {fn && (
                      <Typography
                        sx={{ fontSize: 12, color: colors.neutral500 }}
                      >
                        {fn}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={breakdownCellSx}>
                    <Typography sx={{ fontSize: 13, color: colors.ink }}>
                      {r.question ?? `Question #${r.questionid}`}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={breakdownCellSx}>
                    <ScoreCell score={score} tier={tier} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

/**
 * Trend radar (Current solid, Previous dashed) drawn into the right hero card.
 */
function TrendRadar({
  scores,
  latestScore,
}: {
  scores: ScoreAggregate[]
  latestScore: ScoreAggregate
}) {
  const radarData = useMemo(() => {
    const prev = scores
      .filter((s) => s.datacallid < latestScore.datacallid)
      .sort((a, b) => b.datacallid - a.datacallid)[0]
    return (latestScore.pillarscores ?? []).map((p) => ({
      pillar: p.pillar,
      current: p.score ?? 0,
      previous:
        prev?.pillarscores?.find((pp) => pp.pillarid === p.pillarid)?.score ??
        0,
    }))
  }, [scores, latestScore])

  return (
    <Box sx={{ width: '100%', height: 240, mt: 1 }} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={colors.neutral200} />
          <PolarAngleAxis
            dataKey="pillar"
            tick={{ fontSize: 11, fill: colors.neutral500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, MAX_SCORE]}
            tick={{ fontSize: 10, fill: colors.neutral400 }}
            tickCount={5}
          />
          <Radar
            name="Current"
            dataKey="current"
            stroke={colors.primary}
            fill={colors.primary}
            fillOpacity={0.22}
            strokeWidth={2}
          />
          {scores.length > 1 && (
            <Radar
              name="Previous"
              dataKey="previous"
              stroke={colors.neutral400}
              fill={colors.neutral400}
              fillOpacity={0.14}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              value.toFixed(2),
              name === 'current' ? 'Current' : 'Previous',
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  )
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

function Card({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.25,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
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

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 500,
          color: colors.neutral500,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: 16,
          fontWeight: 700,
          color: colors.ink,
          fontFamily: mono ? fonts.mono : 'inherit',
        }}
      >
        {value}
      </Typography>
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

function TierChip({ tier }: { tier: ScoreTier }) {
  const palette = TIER_CHIP_STYLES[tier]
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        px: 1,
        py: 0.25,
        borderRadius: `${radius.pill}px`,
        color: palette.color,
        backgroundColor: palette.backgroundColor,
      }}
    >
      {tier}
    </Box>
  )
}

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
      {flat ? (
        <TrendingFlatIcon sx={{ fontSize: 14 }} />
      ) : up ? (
        <ArrowUpwardIcon sx={{ fontSize: 14 }} />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 14 }} />
      )}
      <span>
        {flat ? 'No change' : `${up ? '+' : ''}${delta.toFixed(2)}`}
        {previousDatacallName ? ` vs ${previousDatacallName}` : ''}
        {` (was ${previous.toFixed(2)})`}
      </span>
    </Box>
  )
}

function CompactTrend({
  current,
  previous,
}: {
  current: number
  previous?: number
}) {
  if (typeof previous !== 'number') {
    return (
      <Typography
        component="span"
        sx={{ fontSize: 12, color: colors.neutral500 }}
      >
        first run
      </Typography>
    )
  }
  const delta = current - previous
  const flat = Math.abs(delta) < 0.005
  const up = delta > 0
  const color = flat ? colors.neutral500 : up ? colors.up : colors.down
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        color,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {flat ? (
        <TrendingFlatIcon sx={{ fontSize: 12 }} />
      ) : up ? (
        <ArrowUpwardIcon sx={{ fontSize: 12 }} />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 12 }} />
      )}
      <span>{flat ? 'no change' : `${up ? '+' : ''}${delta.toFixed(2)}`}</span>
    </Box>
  )
}

function TrendingPill({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'flat') return null
  const up = direction === 'up'
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        fontSize: 11,
        fontWeight: 600,
        color: up ? colors.up : colors.down,
      }}
    >
      {up ? (
        <ArrowUpwardIcon sx={{ fontSize: 12 }} />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 12 }} />
      )}
      {up ? 'trending up' : 'trending down'}
    </Box>
  )
}

function ScoreCell({
  score,
  tier,
}: {
  score: number | undefined
  tier: ScoreTier
}) {
  const notAssessed = tier === 'Not Assessed' || typeof score !== 'number'
  const dotColor = tierDot[tier]
  const tierColor = TIER_CHIP_STYLES[tier].color
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      <Box
        component="span"
        sx={{
          fontFamily: fonts.mono,
          fontSize: 13,
          fontWeight: 600,
          color: colors.ink,
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {notAssessed ? '-' : score.toFixed(2)}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 12, fontWeight: 500, color: tierColor }}
      >
        {tier}
      </Box>
    </Box>
  )
}

function FilterAutocomplete({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  options: string[]
  value: string | null
  onChange: (next: string | null) => void
  placeholder: string
  ariaLabel: string
}) {
  return (
    <Autocomplete
      size="small"
      options={options}
      value={value}
      onChange={(_event, next) => onChange(next)}
      sx={{
        width: 170,
        '& .MuiInputBase-root': {
          height: 30,
          fontSize: 13,
          py: '0 !important',
        },
        '& .MuiAutocomplete-input': { py: '0 !important' },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          inputProps={{
            ...params.inputProps,
            'aria-label': ariaLabel,
          }}
        />
      )}
    />
  )
}

const breakdownCellSx = {
  borderBottom: `1px solid ${colors.neutral200}`,
  py: 1.25,
}

function BreakdownHeadCell({
  children,
  align,
  sx,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  sx?: object
}) {
  return (
    <TableCell
      align={align}
      sx={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: colors.neutral500,
        backgroundColor: colors.neutral50,
        borderBottom: `1px solid ${colors.neutral200}`,
        ...sx,
      }}
    >
      {children}
    </TableCell>
  )
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                       */
/* ------------------------------------------------------------------ */

function pillarRank(name: string | undefined): number {
  if (!name) return Number.MAX_SAFE_INTEGER
  const i = PILLAR_ORDER.indexOf(name)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

function trendDirection(
  current: number,
  previous?: number
): 'up' | 'down' | 'flat' | undefined {
  if (typeof previous !== 'number') return undefined
  const delta = current - previous
  if (Math.abs(delta) < 0.005) return 'flat'
  return delta > 0 ? 'up' : 'down'
}
