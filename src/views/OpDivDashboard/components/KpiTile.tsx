/**
 * A single KPI tile: label, value, and an optional qualifying hint.
 *
 * The hint slot exists so a count can carry its own denominator or its own
 * unknowns. "12 HVAs" beside "4 unknown" is honest; "12 HVAs" alone quietly
 * claims the other systems are not HVAs when nobody has recorded them.
 *
 * The `tone` prop is what makes the top row a severity ranking rather than an
 * inventory. It is never the only channel: a toned tile also carries an icon
 * and states its count in words, so the alert survives a monochrome print, a
 * forced-colors mode, and a reader who cannot separate the hues.
 *
 * @module views/OpDivDashboard/components/KpiTile
 */
import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { SxProps, Theme } from '@mui/material/styles'
import { colors, fonts, radius, status } from '@/theme/tokens'
import Eyebrow from '@/components/ui/Eyebrow'
import { jumpToPanel } from './jumpToPanel'

/** How urgent a tile is. */
export type KpiTone = 'danger' | 'warning' | 'good' | 'neutral'

/** Accent, value color and icon per tone. */
const TONES: Record<
  KpiTone,
  { accent: string; value: string; Icon: typeof ErrorOutlineIcon | null }
> = {
  danger: {
    accent: status.danger.color,
    value: status.danger.color,
    Icon: ErrorOutlineIcon,
  },
  warning: { accent: colors.down, value: colors.down, Icon: WarningAmberIcon },
  good: { accent: colors.up, value: colors.up, Icon: CheckCircleOutlineIcon },
  neutral: { accent: colors.neutral200, value: colors.ink, Icon: null },
}

/** Props for {@link KpiTile}. */
export type KpiTileProps = {
  label: string
  value: ReactNode
  hint?: ReactNode
  valueColor?: string
  hintColor?: string
  /** Severity. Drives the accent rail, the value color and the icon. */
  tone?: KpiTone
  /**
   * What the figure counts and how to read it, shown on hover or focus.
   *
   * On the whole tile rather than on an info button beside the label, unlike
   * ChartCard: half these tiles are themselves buttons, and a button nested in
   * a button is neither valid nor reachable. Making the tile the trigger keeps
   * the explanation one hover away and, because the tile is focusable, keyboard
   * reachable too.
   */
  info?: string
  /**
   * Scrolls to the panel that names the systems behind the count. Given only
   * when such a panel exists - a tile that looks clickable and goes nowhere is
   * worse than one that does not.
   */
  jumpToId?: string
}

/**
 * Renders one statistic tile.
 * @param {KpiTileProps} props - Label, value, tone and optional hint.
 * @returns {JSX.Element} The tile.
 */
export default function KpiTile({
  label,
  value,
  hint,
  valueColor,
  hintColor,
  tone = 'neutral',
  jumpToId,
  info,
}: KpiTileProps) {
  const { accent, value: toneValue, Icon } = TONES[tone]

  const body = (
    <>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}
      >
        {Icon && (
          <Icon aria-hidden="true" sx={{ fontSize: 14, color: accent }} />
        )}
        <Eyebrow>{label}</Eyebrow>
        {/* Signals that an explanation is a hover away. Decorative - the tile
            itself is the trigger, so this must not be a second target. */}
        {info && (
          <InfoOutlinedIcon
            aria-hidden="true"
            sx={{ fontSize: 13, color: colors.neutral500, ml: 'auto' }}
          />
        )}
      </Box>
      <Typography
        sx={{
          // Proportional figures: tabular-nums makes a large standalone value
          // read loose. Alignment only matters in columns.
          fontFamily: fonts.mono,
          fontSize: 26,
          fontWeight: 800,
          lineHeight: 1.1,
          color: valueColor ?? toneValue,
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 500,
            color: hintColor ?? colors.neutral500,
          }}
        >
          {hint}
        </Typography>
      )}
    </>
  )

  const frame: SxProps<Theme> = {
    backgroundColor: colors.white,
    border: `1px solid ${colors.neutral200}`,
    // The rail, not a tinted fill: four filled alert cards in a row read as an
    // emergency whatever the numbers say.
    ...(tone !== 'neutral' && { borderLeft: `3px solid ${accent}` }),
    borderRadius: `${radius.card}px`,
    p: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left' as const,
    gap: 0.5,
    minWidth: 0,
    '&:focus-visible': {
      outline: `2px solid ${colors.primary}`,
      outlineOffset: 2,
    },
  }

  const tile = jumpToId ? (
    <ButtonBase
      // Not an anchor: the destination is a panel on this same page, and a
      // real #hash would fight the hash router that owns the URL.
      onClick={() => jumpToPanel(jumpToId)}
      sx={{
        ...frame,
        width: '100%',
        '&:hover': { backgroundColor: colors.neutral50 },
      }}
    >
      {body}
    </ButtonBase>
  ) : (
    // Focusable only when it has something to say, so the tab order does not
    // fill up with tiles that reveal nothing on focus.
    <Box sx={frame} tabIndex={info ? 0 : undefined}>
      {body}
    </Box>
  )

  if (!info) return tile
  // describeChild, not the default: a bare Tooltip becomes the child's
  // aria-LABEL, which would replace "Not started, 1 of 2" with a paragraph of
  // explanation as the tile's name. The explanation is a description; the
  // label and value are the name.
  return (
    <Tooltip title={<span>{info}</span>} describeChild>
      {tile}
    </Tooltip>
  )
}
