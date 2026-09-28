import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, fonts, radius, status } from '@/theme/tokens'
import type { Category } from '../helpers'

/** Props for {@link PillarGroup}. */
export type PillarGroupProps = {
  /** Eyebrow label rendered above the list (e.g. "Pillars"). */
  eyebrow: string
  /** Pillar entries to render. */
  items: Category[]
  /** Name of the currently-active pillar; used to highlight its row. */
  currentName: string
  /** Counts the answered functions inside a pillar; drives the X / Y badge. */
  answeredCountInCategory: (cat: Category) => number
  /**
   * Counts the carried-forward, not-yet-confirmed functions inside a pillar.
   * Renders an "N to confirm" line under the pillar so the whole
   * questionnaire's remaining-confirmation work is scannable from the rail
   * (the per-question markers live in the section rail). Omit to render no
   * confirmation lines (e.g. a closed call).
   */
  toConfirmCountInCategory?: (cat: Category) => number
  /** Called when the user picks a pillar. */
  onClick: (category: Category) => void
}

/**
 * One eyebrow + list block inside the {@link PillarRail}. Renders each
 * pillar as a clickable row with the pillar name on the left and the
 * answered / total count on the right. When a row is fully answered the
 * count turns green via the up-trend color.
 *
 * Used twice on the page: once for the main pillars and once for the
 * Cross-cutting group below.
 * @param {PillarGroupProps} props - Component props.
 * @returns {JSX.Element} The pillar group.
 */
export default function PillarGroup({
  eyebrow,
  items,
  currentName,
  answeredCountInCategory,
  toConfirmCountInCategory,
  onClick,
}: PillarGroupProps) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: colors.neutral500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          px: 1,
          mb: 0.5,
        }}
      >
        {eyebrow}
      </Typography>
      <Box>
        {items.map((cat) => {
          const isCurrent = cat.name === currentName
          const total = cat.steps.length
          const answered = answeredCountInCategory(cat)
          const toConfirm = toConfirmCountInCategory?.(cat) ?? 0
          return (
            <Box
              key={cat.name}
              role="button"
              tabIndex={0}
              onClick={() => onClick(cat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onClick(cat)
              }}
              sx={{
                px: 1,
                py: 0.75,
                borderRadius: `${radius.sm}px`,
                cursor: 'pointer',
                backgroundColor: isCurrent ? colors.primary50 : 'transparent',
                color: isCurrent ? colors.ink900 : colors.ink,
                fontWeight: isCurrent ? 600 : 500,
                '&:hover': {
                  backgroundColor: isCurrent
                    ? colors.primary50
                    : colors.neutral50,
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 'inherit' }}>
                  {cat.name === 'CrossCutting' ? 'Cross-cutting' : cat.name}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: fonts.mono,
                    fontSize: 12,
                    color: answered === total ? colors.up : colors.neutral500,
                    fontWeight: answered === total ? 600 : 500,
                  }}
                >
                  {answered} / {total}
                </Typography>
              </Box>
              {toConfirm > 0 && (
                // Text-bearing, not color-only (508); same classification the
                // section rail's per-question markers read.
                <Typography sx={{ fontSize: 11, color: status.warning.color }}>
                  {toConfirm} to confirm
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
