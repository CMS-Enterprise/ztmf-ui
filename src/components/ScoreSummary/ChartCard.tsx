/**
 * Card shell for a dashboard figure: eyebrow, optional subtitle, body.
 *
 * The subtitle is where a figure states its own scope. Several figures on this
 * page describe a narrower slice than the page does (one data call, only
 * scored systems), and an unqualified number is how a dashboard misleads.
 *
 * @module components/ScoreSummary/ChartCard
 */
import { ReactNode, useId } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Typography from '@mui/material/Typography'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import { colors } from '@/theme/tokens'

/** Props for {@link ChartCard}. */
export type ChartCardProps = {
  /** Uppercase eyebrow naming the figure. */
  eyebrow: string
  /** Scope qualifier - which call, which denominator. */
  subtitle?: ReactNode
  /** Right-aligned control or count. */
  action?: ReactNode
  /**
   * Explains what the figure is and how to read it. Rendered as a focusable
   * info affordance beside the eyebrow - keyboard-reachable, since a
   * hover-only explanation is no explanation for some readers.
   */
  info?: string
  children: ReactNode
  sx?: object
  /** Scroll anchor, for in-page jumps from a summary tile. */
  id?: string
}

/**
 * Wraps a figure in the standard card with its title and scope note.
 * @param {ChartCardProps} props - Eyebrow, optional subtitle/action, body.
 * @returns {JSX.Element} The card.
 */
export default function ChartCard({
  eyebrow,
  subtitle,
  action,
  info,
  children,
  sx,
  id,
}: ChartCardProps) {
  const headingId = useId()
  return (
    <Card
      id={id}
      role="region"
      aria-labelledby={headingId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, ...sx }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Eyebrow component="h2" id={headingId}>
              {eyebrow}
            </Eyebrow>
            {info && (
              // describeChild, or the button's aria-label wins and the explanation is never announced.
              <Tooltip title={<span>{info}</span>} describeChild>
                <IconButton
                  size="small"
                  aria-label={`About ${eyebrow}`}
                  sx={{ p: 0.25, color: colors.neutral500 }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {subtitle && (
            <Typography
              sx={{ fontSize: 12, color: colors.neutral500, mt: 0.25 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      {children}
    </Card>
  )
}
