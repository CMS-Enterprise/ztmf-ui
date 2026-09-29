/**
 * The dashboard's hero figure: the OpDiv's overall maturity score.
 *
 * Exactly one hero per view. The number is the chart - a single value with a
 * comparison does not want a plot, it wants to be readable from across a room.
 *
 * @module views/OpDivDashboard/components/OpDivHero
 */
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Typography from '@mui/material/Typography'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import TierLabel from '@/components/ui/TierLabel'
import { colors, fonts } from '@/theme/tokens'
import { tierForScore } from '@/utils/tierStyles'
import ScoreMeter from './ScoreMeter'
import type { PairedDelta } from '../opdivTrend'

/** Explains the headline figure and the scale behind it. */
const HERO_INFO =
  "The average score of this scope's scored systems, on the 1.0-5.0 HHS maturity scale: Optimal from 4.10, Advanced from 3.10, Initial from 2.10, Traditional from 1.01. Systems with no score are left out of the average rather than counted as zero. The comparison below is paired system-by-system against the prior call, so a changed system mix cannot read as movement."

/** Props for {@link OpDivHero}. */
export type OpDivHeroProps = {
  /** Average score across scored systems, or null when none are scored. */
  avgScore: number | null
  /** Systems behind the average, for the denominator note. */
  scoredCount: number
  systemCount: number
  /** Paired comparison against the prior data call. */
  delta: PairedDelta
  /** Display name of the baseline call, when there is one. */
  priorLabel?: string
}

/**
 * Renders the overall score, its tier, its position on the scale, and the
 * paired change against the prior data call.
 * @param {OpDivHeroProps} props - Score, denominators and comparison.
 * @returns {JSX.Element} The hero card.
 */
export default function OpDivHero({
  avgScore,
  scoredCount,
  systemCount,
  delta,
  priorLabel,
}: OpDivHeroProps) {
  // An OpDiv average is not a graded system, so there is no API tier for it.
  // This is the documented exception where deriving from the number is right.
  const tier = avgScore !== null ? tierForScore(avgScore) : undefined
  const flat = delta.delta !== null && Math.abs(delta.delta) < 0.005

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Eyebrow>Overall ZT score</Eyebrow>
        <Tooltip title={HERO_INFO}>
          <IconButton
            size="small"
            aria-label="About the overall ZT score"
            sx={{ p: 0.25, color: colors.neutral400 }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
        <Typography
          component="p"
          sx={{
            fontFamily: fonts.base,
            fontSize: 48,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: avgScore !== null ? colors.ink : colors.neutral400,
          }}
        >
          {avgScore !== null ? avgScore.toFixed(2) : '—'}
        </Typography>
        <TierLabel tier={tier} />
      </Box>

      <ScoreMeter score={avgScore} />

      <Typography sx={{ fontSize: 12, color: colors.neutral500, mt: 0.5 }}>
        {scoredCount === 0
          ? `No scored systems yet · ${systemCount} in this OpDiv`
          : `Average of ${scoredCount} scored ${
              scoredCount === 1 ? 'system' : 'systems'
            } of ${systemCount}`}
      </Typography>

      {/* The comparison is paired over systems scored in BOTH calls, so the
          denominator is named: an unpaired average lets a changed system mix
          read as movement nobody earned. */}
      {delta.delta !== null && delta.priorAvg !== null ? (
        <Typography
          sx={{
            // Sits at the bottom once the card stretches to match the KPI
            // block beside it, so the content spreads rather than clumping.
            mt: 'auto',
            pt: 0.5,
            fontSize: 13,
            fontWeight: 600,
            color: flat
              ? colors.neutral500
              : delta.delta > 0
                ? colors.up
                : colors.down,
          }}
        >
          {flat
            ? 'No change'
            : `${delta.delta > 0 ? '+' : ''}${delta.delta.toFixed(2)}`}
          {priorLabel ? ` vs ${priorLabel}` : ''}
          {` (was ${delta.priorAvg.toFixed(2)}, ${delta.n} ${
            delta.n === 1 ? 'system' : 'systems'
          } in both)`}
        </Typography>
      ) : (
        <Typography
          sx={{ mt: 'auto', pt: 0.5, fontSize: 13, color: colors.neutral500 }}
        >
          No prior data call to compare against.
        </Typography>
      )}
    </Card>
  )
}
