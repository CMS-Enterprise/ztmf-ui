import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { fipsBadgeText, FIPS_GOLD, type FipsBaseline } from './fipsBaseline'

// A baseline always has headroom (ceiling 1-3), so Optimal never appears here.
const CEILING_LABEL: Record<number, string> = {
  1: 'Traditional',
  2: 'Initial',
  3: 'Advanced',
}

// FIPS baseline strip, rendered once by the page above the options (and above
// the Insights panel when there is one) for every OpDiv (ztmf-ui#764).
export default function FipsBaselineStrip({ level, ceiling }: FipsBaseline) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        bgcolor: FIPS_GOLD.box,
        border: `1px solid ${FIPS_GOLD.border}`,
        borderRadius: '6px',
        p: '8px 14px',
        mb: 1.5,
        fontSize: 12,
      }}
    >
      <Tooltip
        title={`FIPS impact level for this system: ${level}`}
        placement="top"
        arrow
      >
        <Box
          component="span"
          tabIndex={0}
          aria-label={`FIPS impact level: ${level}`}
          sx={{
            fontSize: 11,
            fontWeight: 700,
            bgcolor: FIPS_GOLD.badgeBg,
            color: FIPS_GOLD.badgeText,
            px: 1,
            py: 0.25,
            borderRadius: '3px',
            letterSpacing: '0.3px',
            flexShrink: 0,
            cursor: 'help',
          }}
        >
          {fipsBadgeText(level)}
        </Box>
      </Tooltip>
      <Box
        component="span"
        sx={{ color: FIPS_GOLD.text, flex: 1, lineHeight: 1.5 }}
      >
        Baseline for this system is{' '}
        <Box component="span" sx={{ fontWeight: 700, color: FIPS_GOLD.strong }}>
          {CEILING_LABEL[ceiling]}
        </Box>
        . Higher maturity levels are available - teams that go above baseline
        are encouraged to document what&rsquo;s driving that maturity.
      </Box>
    </Box>
  )
}
