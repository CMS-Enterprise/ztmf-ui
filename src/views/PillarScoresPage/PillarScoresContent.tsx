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
import type { FismaQuestion, ScoreAggregate, ScoreTier } from '@/types'
import { TIER_CHIP_STYLES, tierForScore } from '@/utils/tierStyles'
import { isAuthHandled } from '@/utils/notify'
import { colors, fonts, radius, tierDot } from '@/theme/tokens'
import { PILLAR_ORDER } from '@/constants'

/**
 * Highest possible zero trust score on the user-facing scale, used to
 * normalize progress bars and the radar axis. The backend computes scores
 * on a 1.0-5.0 scale via the +1 shift at aggregation
 * (backend/internal/model/scores.go).
 */
const MAX_SCORE = 5

/** All tier strings in display order, for the breakdown filter dropdown. */
const TIER_OPTIONS: ScoreTier[] = [
  'Optimal',
  'Advanced',
  'Initial',
  'Traditional',
  'Not Assessed',
]

/**
 * Shape of a /scores row when fetched with ?include=functionoption.
 *
 * The Score row itself only carries `functionoptionid`. The joined
 * `functionoption` brings back the picked option's numeric score (1-4) and
 * its parent `functionid`, which is what we need to join back to a question
 * (each question has one function via /fismasystems/{id}/questions).
 */
interface QuestionScoreRow {
  scoreid: number
  functionoptionid: number
  functionoption?: {
    functionoptionid: number
    functionid: number
    score: number
    optionname: string
    description: string
  }
}

/**
 * Joined view-model for a single row of the question-level breakdown,
 * computed by stitching /fismasystems/{id}/questions against
 * /scores?...&include=functionoption.
 *
 * `displayScore` is on the user-facing 1-5 scale: per-option raw scores from
 * the backend live on a 0-4 scale, and the aggregation applies a +1 shift to
 * land on 1-5. The breakdown table displays a per-question (per-option)
 * score, so we apply the same shift here so the row tiers visually agree
 * with the pillar grid above (also on 1-5 from the aggregate endpoint).
 */
interface QuestionBreakdownRow {
  scoreid: number
  questionid: number
  question: string
  pillar: string
  functionName: string
  displayScore: number
  tier: ScoreTier
}

/** Props for {@link PillarScoresContent}. */
export interface PillarScoresContentProps {
  /** Score aggregates for the system across one or more datacalls. */
  scores: ScoreAggregate[]
  /** The datacall to show as the current period. */
  selectedDataCallId: number
  /** Stable system id, for the question-level breakdown fetch. */
  fismasystemid: number
  /** Human-readable name of the current datacall, shown in the hero stats. */
  currentDatacallName?: string
  /** Human-readable name of the previous datacall, used in the trend line. */
  previousDatacallName?: string
  /**
   * Datacall id to use as the trend baseline. Overrides the implicit
   * "most recent prior datacall on this system" lookup; lets the parent
   * page tie the trend to the user's pick from the Compare Datacalls
   * modal. Falls back to the implicit lookup when undefined.
   */
  comparisonFromDatacallId?: number
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
  comparisonFromDatacallId,
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

  // Previous-score lookup respects the parent's explicit comparison pick
  // (driven by the Compare Datacalls modal) and falls back to the most
  // recent prior datacall on this system when nothing's been picked yet.
  const previousScore = useMemo(() => {
    if (!latestScore) return undefined
    if (typeof comparisonFromDatacallId === 'number') {
      return scores.find((s) => s.datacallid === comparisonFromDatacallId)
    }
    return scores
      .filter((s) => s.datacallid < latestScore.datacallid)
      .sort((a, b) => b.datacallid - a.datacallid)[0]
  }, [scores, latestScore, comparisonFromDatacallId])

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
        <TrendRadar
          latestScore={latestScore}
          previousScore={previousScore}
          hasPrevious={scores.length > 1}
        />
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
 * Per-question table with pillar + tier filters. Builds rows by joining two
 * endpoints (since /scores alone has no question text, pillar or function):
 *  - /fismasystems/{id}/questions -> question text + pillar + function name,
 *    keyed by functionid (each question has exactly one function);
 *  - /scores?datacallid=...&fismasystemid=...&include=functionoption -> the
 *    picked option per question, carrying functionid + numeric score.
 * The tier is derived from the option's integer score using the same
 * thresholds the aggregate endpoint uses, so the colored chip matches the
 * pillar grid above.
 */
function QuestionBreakdown({
  fismasystemid,
  datacallid,
}: {
  fismasystemid: number
  datacallid: number
}) {
  const [questions, setQuestions] = useState<FismaQuestion[]>([])
  const [scores, setScores] = useState<QuestionScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pillarFilter, setPillarFilter] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<ScoreTier | null>(null)

  useEffect(() => {
    if (!fismasystemid || !datacallid) return
    const controller = new AbortController()
    setLoading(true)
    async function load() {
      try {
        const [questionsRes, scoresRes] = await Promise.all([
          axiosInstance.get(`/fismasystems/${fismasystemid}/questions`, {
            signal: controller.signal,
          }),
          axiosInstance.get(
            `scores?datacallid=${datacallid}&fismasystemid=${fismasystemid}&include=functionoption`,
            { signal: controller.signal }
          ),
        ])
        setQuestions(questionsRes.data?.data ?? [])
        setScores(scoresRes.data?.data ?? [])
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

  // Index questions by functionid so the score join is O(1) per row. Each
  // question is associated with exactly one function on the backend.
  const questionByFunctionId = useMemo(() => {
    const map = new Map<
      number,
      {
        questionid: number
        question: string
        pillar: string
        functionName: string
      }
    >()
    for (const q of questions) {
      if (q.function?.functionid != null) {
        map.set(q.function.functionid, {
          questionid: q.questionid,
          question: q.question,
          pillar: q.pillar?.pillar ?? '-',
          functionName: q.function.function,
        })
      }
    }
    return map
  }, [questions])

  // Join scores against the question map, dropping any score whose function
  // we can't resolve (defensive: a stale score row for a removed function).
  // Apply the same +1 shift the backend uses at aggregation so the per-row
  // tier lookup uses the authoritative thresholds and the displayed value
  // matches the 1-5 scale shown elsewhere on the page.
  const rows: QuestionBreakdownRow[] = useMemo(() => {
    const out: QuestionBreakdownRow[] = []
    for (const s of scores) {
      const fid = s.functionoption?.functionid
      if (fid == null) continue
      const q = questionByFunctionId.get(fid)
      if (!q) continue
      const rawScore = s.functionoption?.score ?? 0
      const displayScore = rawScore + 1
      out.push({
        scoreid: s.scoreid,
        questionid: q.questionid,
        question: q.question,
        pillar: q.pillar,
        functionName: q.functionName,
        displayScore,
        tier: tierForScore(displayScore),
      })
    }
    // Stable sort by pillar order then function name so consecutive rows in
    // the same pillar group together visually.
    return out.sort((a, b) => {
      const pr = pillarRank(a.pillar) - pillarRank(b.pillar)
      if (pr !== 0) return pr
      return a.functionName.localeCompare(b.functionName)
    })
  }, [scores, questionByFunctionId])

  const pillarOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.pillar)
    return Array.from(set).sort((a, b) => pillarRank(a) - pillarRank(b))
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (pillarFilter && r.pillar !== pillarFilter) return false
      if (tierFilter && r.tier !== tierFilter) return false
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
            {loading
              ? 'Loading...'
              : `${rows.length} ${rows.length === 1 ? 'question' : 'questions'}`}
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
            {filtered.map((r) => (
              <TableRow key={r.scoreid}>
                <TableCell sx={breakdownCellSx}>
                  <Typography
                    sx={{ fontSize: 13, fontWeight: 600, color: colors.ink }}
                  >
                    {r.pillar}
                  </Typography>
                  {r.functionName && (
                    <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
                      {r.functionName}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={breakdownCellSx}>
                  <Typography sx={{ fontSize: 13, color: colors.ink }}>
                    {r.question}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={breakdownCellSx}>
                  <ScoreCell score={r.displayScore} tier={r.tier} />
                </TableCell>
              </TableRow>
            ))}
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
  latestScore,
  previousScore,
  hasPrevious,
}: {
  latestScore: ScoreAggregate
  previousScore?: ScoreAggregate
  hasPrevious: boolean
}) {
  // Radar data uses the previousScore the parent decided on (which respects
  // the user's Compare Datacalls modal pick), not a local N-1 lookup.
  const radarData = useMemo(() => {
    return (latestScore.pillarscores ?? []).map((p) => ({
      pillar: p.pillar,
      current: p.score ?? 0,
      previous:
        previousScore?.pillarscores?.find((pp) => pp.pillarid === p.pillarid)
          ?.score ?? 0,
    }))
  }, [previousScore, latestScore])

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
          {hasPrevious && (
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
