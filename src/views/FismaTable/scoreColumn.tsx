import { Box } from '@mui/material'
import type { SystemScoreEntry } from '@/types'
import { TIERS } from '@/utils/tierStyles'

/**
 * The Zero Trust Score cell. A system with no aggregate row reads "Not scored"
 * so it is distinguishable from a system genuinely assessed at 0.00, which the
 * old shared 0.00 rendering hid. A scored cell keeps the tier-colored badge.
 * @param {object} props - Component props.
 * @param {SystemScoreEntry} [props.entry] - The system's score entry, if any.
 * @returns {JSX.Element} The rendered cell.
 */
export function ScoreCell({ entry }: { entry?: SystemScoreEntry }) {
  if (!entry) {
    return <Box sx={{ color: 'text.secondary' }}>Not scored</Box>
  }
  const score = entry.score ?? 0
  // Tier comes from the backend on /scores/aggregate; do not derive it from the
  // numeric score. A cell without a tier renders with no fill so a transient
  // deploy mismatch reads as "unknown" rather than a misleading color.
  const backgroundColor = entry.tier
    ? TIERS[entry.tier]?.cell.backgroundColor ?? 'transparent'
    : 'transparent'
  return (
    <Box
      sx={{
        border: 1,
        p: 1,
        px: 4,
        borderRadius: 2,
        borderColor: 'darkgray',
        backgroundColor,
      }}
    >
      {score.toFixed(2)}
    </Box>
  )
}
