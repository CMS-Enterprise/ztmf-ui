/**
 * Labeled horizontal bar list - the workhorse figure on this dashboard.
 *
 * Why a labeled list rather than a pie or a stacked bar, for distributions:
 * the app's tier palette is a semantic one (green = good, purple = legacy),
 * reviewed for isolated marks like chips and table cells. Checked as adjacent
 * fills it fails - Advanced (#C19A00) and Initial (#D85C00) sit at ΔE 14.7 for
 * normal vision and 7.4 under deuteranopia, and they are neighbours in the
 * tier order, so in a stack or a pie they would touch. Giving every value its
 * own labeled row removes the adjacency entirely, keeps one palette across the
 * app, and shows exact counts instead of angles.
 *
 * It is also its own table view: the label and value are real text, so nothing
 * here is gated behind color or a tooltip.
 *
 * @module views/OpDivDashboard/components/BarList
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, fonts, radius } from '@/theme/tokens'

/** One row of a {@link BarList}. */
export type BarListItem = {
  /** Row label. Carries identity, so color never has to. */
  label: string
  /** Magnitude driving the bar length. */
  value: number
  /** Text at the bar tip. Defaults to the value. */
  display?: string
  /** Bar fill. Defaults to the sequential accent. */
  color?: string
  /** Muted qualifier after the label, e.g. a shorter denominator. */
  note?: string
}

/** Props for {@link BarList}. */
export type BarListProps = {
  items: BarListItem[]
  /**
   * Scale maximum. Defaults to the largest value, which makes the list a
   * comparison among its own rows; pass an absolute max (a total, or the 5.0
   * score ceiling) when rows should be read against that instead.
   */
  max?: number
  /**
   * Scale minimum, default 0. Counts start at zero, but maturity scores start
   * at 1.0 - measuring those from zero spends a fifth of every bar on range
   * that cannot be lost, so the floor renders a fifth full and the meaningful
   * 1-5 spread is squeezed into the rest.
   */
  min?: number
  /** Shown when there is nothing to plot. */
  emptyMessage?: string
  /** Label width in px. Widen for long names. */
  labelWidth?: number
}

/**
 * Renders one labeled, value-carrying bar per item.
 * @param {BarListProps} props - Items and scale.
 * @returns {JSX.Element} The bar list.
 */
export default function BarList({
  items,
  max,
  min = 0,
  emptyMessage = 'Nothing to show',
  labelWidth = 104,
}: BarListProps) {
  if (items.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
        {emptyMessage}
      </Typography>
    )
  }

  // Guard the divisor: an all-zero list, or a max equal to min, would
  // otherwise divide by zero and render every bar as NaN% wide.
  const ceiling = max ?? Math.max(...items.map((i) => i.value))
  const scale = Math.max(ceiling - min, 1e-9)

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {items.map((item) => (
        <Box
          component="li"
          key={item.label}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
          }}
        >
          <Typography
            sx={{
              width: labelWidth,
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 500,
              color: colors.neutral700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={item.label}
          >
            {item.label}
          </Typography>
          {/* Decorative: every value it encodes is printed as text beside it. */}
          <Box
            aria-hidden="true"
            sx={{
              flex: 1,
              minWidth: 0,
              height: 8,
              backgroundColor: colors.neutral100,
              borderRadius: `${radius.sm}px`,
              overflow: 'hidden',
            }}
          >
            <Box
              // Width is inline, not sx: it is per-row data, and emotion would
              // mint a fresh class for every distinct value.
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, ((item.value - min) / scale) * 100)
                )}%`,
              }}
              sx={{
                height: '100%',
                backgroundColor: item.color ?? colors.primary,
                // Rounded data-end, square at the baseline.
                borderTopRightRadius: `${radius.sm}px`,
                borderBottomRightRadius: `${radius.sm}px`,
              }}
            />
          </Box>
          <Typography
            sx={{
              minWidth: 32,
              textAlign: 'right',
              flexShrink: 0,
              fontFamily: fonts.mono,
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: colors.ink,
            }}
          >
            {item.display ?? item.value}
          </Typography>
          {item.note && (
            <Typography
              sx={{
                flexShrink: 0,
                fontSize: 11,
                color: colors.neutral500,
                whiteSpace: 'nowrap',
              }}
            >
              {item.note}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  )
}
