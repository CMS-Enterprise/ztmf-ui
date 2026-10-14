/**
 * The dashboard's hero figure: the OpDiv's overall maturity score.
 *
 * Exactly one hero per view. The number is the chart - a single value with a
 * comparison does not want a plot, it wants to be readable from across a room.
 *
 * @module views/OpDivDashboard/components/OpDivHero
 */
import { useId } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Typography from '@mui/material/Typography'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import TierLabel from '@/components/ui/TierLabel'
import TrendLine from '@/components/ui/TrendLine'
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
  const headingId = useId()

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Eyebrow component="h2" id={headingId}>
          Overall ZT score
        </Eyebrow>
        {/* describeChild, or the button's aria-label wins and the explanation is never announced. */}
        <Tooltip title={<span>{HERO_INFO}</span>} describeChild>
          <IconButton
            size="small"
            aria-label="About the overall ZT score"
            sx={{ p: 0.25, color: colors.neutral500 }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
        <Typography
          component="p"
          sx={{
            fontFamily: fonts.mono,
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: avgScore !== null ? colors.ink : colors.neutral500,
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

      {/* Paired over systems in BOTH calls; names its own averages since they differ from the headline. */}
      <Box sx={{ mt: 'auto', pt: 0.5 }}>
        {delta.currentAvg !== null && delta.priorAvg !== null ? (
          <TrendLine
            current={delta.currentAvg}
            previous={delta.priorAvg}
            previousDatacallName={priorLabel}
            pairedCount={delta.n}
          />
        ) : (
          <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
            {priorLabel
              ? `No system was scored in both this call and ${priorLabel}.`
              : 'No prior data call to compare against.'}
          </Typography>
        )}
      </Box>
    </Card>
  )
}
