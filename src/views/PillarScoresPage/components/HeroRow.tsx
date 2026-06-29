import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, fonts } from '@/theme/tokens'
import type { ScoreAggregate } from '@/types'
import Card from './Card'
import Eyebrow from './Eyebrow'
import Stat from './Stat'
import TierLabel from './TierLabel'
import TrendLine from './TrendLine'
import TrendingPill from './TrendingPill'
import TrendRadar from './TrendRadar'
import { trendDirection } from './helpers'

/** Props for {@link HeroRow}. */
export type HeroRowProps = {
  /** Score aggregate for the current datacall. */
  latestScore: ScoreAggregate
  /** Score aggregate for the prior datacall when available. */
  previousScore?: ScoreAggregate
  /** Display name for the current datacall (used by the Datacall stat). */
  currentDatacallName?: string
  /** Display name for the prior datacall (used inside the trend line). */
  previousDatacallName?: string
  /**
   * Full set of score aggregates - passed straight through to TrendRadar
   * so it knows whether to draw the Previous overlay.
   */
  scores: ScoreAggregate[]
}

/**
 * Top of the Pillar Scores page: a 1:1 two-card hero. Left card hosts the
 * overall ZT score, the trend line, and a small stat row (Pillars at
 * Optimal, Datacall). Right card hosts the radar of pillar scores vs the
 * previous period.
 * @param {HeroRowProps} props - Component props.
 * @returns {JSX.Element} The two-card hero row.
 */
export default function HeroRow({
  latestScore,
  previousScore,
  currentDatacallName,
  previousDatacallName,
  scores,
}: HeroRowProps) {
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
