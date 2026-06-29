import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, fonts, radius, tierDot } from '@/theme/tokens'
import type { ScoreAggregate, ScoreTier } from '@/types'
import Card from './Card'
import TierChip from './TierChip'
import CompactTrend from './CompactTrend'
import { pillarRank } from './helpers'

/**
 * Highest possible zero trust score on the user-facing scale. The backend
 * computes scores on a 1.0-5.0 scale via the +1 shift at aggregation
 * (backend/internal/model/scores.go); duplicated here so the pillar bars
 * don't have to import a constant from the parent file.
 */
const MAX_SCORE = 5

/** Props for {@link PillarGrid}. */
export type PillarGridProps = {
  /** Aggregate for the current datacall - source of pillar scores + tiers. */
  latestScore: ScoreAggregate
  /** Aggregate for the prior datacall - drives the per-pillar trend. */
  previousScore?: ScoreAggregate
}

/**
 * Six-or-so pillar tiles in a 3-column grid. Each tile renders the pillar
 * name, tier chip, large score, a compact trend indicator, and a tier-
 * colored progress bar. Tiles are sorted by the canonical pillar order so
 * the layout is stable across systems.
 * @param {PillarGridProps} props - Component props.
 * @returns {JSX.Element} The pillar grid.
 */
export default function PillarGrid({
  latestScore,
  previousScore,
}: PillarGridProps) {
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
