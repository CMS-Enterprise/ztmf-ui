import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'

/** Props for {@link EyebrowLine}. */
export type EyebrowLineProps = {
  /** Pillar name (or "CrossCutting", which the component humanizes). */
  pillar: string
  /** Active function name (e.g. "App Inventory"). */
  functionName: string
  /** 1-based index of the current question within the section. */
  current: number
  /** Total questions in the section. */
  total: number
}

/**
 * Single-line "PILLAR · function · Q n of m" header above the question
 * card. Designed to read like a breadcrumb without claiming the header
 * style - kept small so the question itself remains the visual anchor.
 * @param {EyebrowLineProps} props - Component props.
 * @returns {JSX.Element} The eyebrow line.
 */
export default function EyebrowLine({
  pillar,
  functionName,
  current,
  total,
}: EyebrowLineProps) {
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          color: colors.ink900,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {pillar === 'CrossCutting' ? 'Cross-cutting' : pillar}
      </Typography>
      {functionName && (
        <>
          <Typography
            component="span"
            sx={{ fontSize: 13, color: colors.neutral500 }}
          >
            {functionName}
          </Typography>
          {total > 0 && (
            <Typography
              component="span"
              sx={{ fontSize: 13, color: colors.neutral500 }}
            >
              · Q{current} of {total}
            </Typography>
          )}
        </>
      )}
    </Box>
  )
}
