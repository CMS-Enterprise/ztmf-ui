/**
 * Maturity stage distribution as a donut plus a counted legend.
 *
 * Part-to-whole at a glance over at most six segments, which is what a pie is
 * for. Two things make it safe with this palette, and both are load-bearing:
 *
 *  1. **A real gap between slices** (`paddingAngle`), not a stroke. The tier
 *     palette is semantic rather than ordinal - checked as adjacent fills,
 *     Advanced (#C19A00) and Initial (#D85C00) sit at ΔE 14.7 for normal
 *     vision and 7.4 under deuteranopia, and they are neighbours in tier
 *     order, so untouched they would meet along an edge.
 *  2. **The legend carries name and count as text.** Nobody has to tell gold
 *     from orange to read this chart; the slice is the glance, the legend is
 *     the answer. That is also the table-view twin, so no value is gated
 *     behind a hover.
 *
 * Inline slice labels are deliberately absent: at six segments with names as
 * long as "Not Assessed" they collide or get clipped, and a clipped label is
 * worse than none.
 *
 * @module views/OpDivDashboard/components/StagePie
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { colors, fonts, radius } from '@/theme/tokens'
import { stageColor } from './stageColor'
import type { Breakdown } from '../opdivBreakdowns'
import type { TierMovement } from '../opdivTrend'

/** Props for {@link StagePie}. */
export type StagePieProps = {
  stage: Breakdown
  /** Net change per tier vs the prior call, paired by system. */
  movement?: TierMovement
  /** Baseline call name, so the movement column says what it compares to. */
  priorLabel?: string
}

/**
 * Renders the stage distribution donut with its counted legend.
 * @param {StagePieProps} props - The stage partition.
 * @returns {JSX.Element} The figure.
 */
export default function StagePie({
  stage,
  movement,
  priorLabel,
}: StagePieProps) {
  // A baseline exists, but that is not the same as anything having moved. With
  // answers carried forward and unconfirmed, every system holds the tier it
  // held last cycle - rendering a column of dashes beside a "Change vs..."
  // caption reads as a broken column rather than as the finding it is.
  const hasBaseline = !!movement && movement.n > 0
  const showMovement =
    hasBaseline && Object.values(movement.byTier).some((v) => v !== 0)
  if (stage.total === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
        No systems in this OpDiv.
      </Typography>
    )
  }

  const data = stage.buckets.filter((b) => b.count > 0)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box
        sx={{ position: 'relative', width: 148, height: 148, flexShrink: 0 }}
        role="img"
        aria-label={`Donut chart of ${stage.total} systems by maturity stage. The same counts are listed beside the chart.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius={44}
              outerRadius={70}
              // A genuine gap in the surface, so neighbouring fills never meet.
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((bucket) => (
                <Cell key={bucket.label} fill={stageColor(bucket.label)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} of ${stage.total} (${Math.round((value / stage.total) * 100)}%)`,
                name,
              ]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: `1px solid ${colors.neutral200}`,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Real text, centered in the hole - selectable and jsdom-visible. */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography
            sx={{
              fontFamily: fonts.mono,
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1,
              color: colors.ink,
            }}
          >
            {stage.total}
          </Typography>
          <Typography sx={{ fontSize: 10, color: colors.neutral500 }}>
            {stage.total === 1 ? 'system' : 'systems'}
          </Typography>
        </Box>
      </Box>

      {/* The identity channel and the table view in one. */}
      <Box
        component="ul"
        sx={{ listStyle: 'none', m: 0, p: 0, flex: 1, minWidth: 128 }}
      >
        {data.map((bucket) => (
          <Box
            component="li"
            key={bucket.label}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.3 }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 9,
                height: 9,
                flexShrink: 0,
                borderRadius: `${radius.sm}px`,
                backgroundColor: stageColor(bucket.label),
              }}
            />
            <Typography
              sx={{
                fontSize: 12,
                color: colors.neutral700,
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {bucket.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: fonts.mono,
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: colors.ink,
              }}
            >
              {bucket.count}
            </Typography>
            <Typography
              sx={{
                fontSize: 11,
                color: colors.neutral500,
                minWidth: 32,
                textAlign: 'right',
              }}
            >
              {Math.round((bucket.count / stage.total) * 100)}%
            </Typography>
            {/* Net movement, paired by system so a changed participant set
                cannot register as systems gaining or losing a tier. Blank
                rather than 0 where nothing moved, so the eye goes to what did. */}
            {showMovement && (
              <Typography
                sx={{
                  minWidth: 34,
                  textAlign: 'right',
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: !movement.byTier[bucket.label]
                    ? colors.neutral400
                    : movement.byTier[bucket.label] > 0
                      ? colors.up
                      : colors.down,
                }}
              >
                {movement.byTier[bucket.label]
                  ? `${movement.byTier[bucket.label] > 0 ? '+' : ''}${movement.byTier[bucket.label]}`
                  : '—'}
              </Typography>
            )}
          </Box>
        ))}
        {hasBaseline && (
          <Typography
            component="li"
            sx={{ fontSize: 11, color: colors.neutral500, pt: 0.75 }}
          >
            {showMovement ? 'Change vs ' : 'No net tier change vs '}
            {priorLabel ?? 'the prior call'}, over {movement.n}{' '}
            {movement.n === 1 ? 'system' : 'systems'} scored in both
          </Typography>
        )}
      </Box>
    </Box>
  )
}
