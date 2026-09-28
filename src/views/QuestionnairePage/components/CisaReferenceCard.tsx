import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { colors } from '@/theme/tokens'
import Card from './Card'

/**
 * Static CISA Zero Trust reference card shown at the bottom of the
 * Questionnaire right rail. The data model does not currently carry a
 * per-question CISA section pointer, so the body is framework-level
 * (true for the whole questionnaire) rather than per-question. If/when
 * the backend grows a per-question CISA section field we can pass it
 * down and make the body specific.
 * @returns {JSX.Element} The CISA reference card.
 */
export default function CisaReferenceCard() {
  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <InfoOutlinedIcon
          sx={{ fontSize: 18, color: colors.primary, mt: 0.25 }}
        />
        <Box>
          <Typography
            sx={{ fontSize: 13, fontWeight: 700, color: colors.ink, mb: 0.5 }}
          >
            CISA reference
          </Typography>
          <Typography
            sx={{ fontSize: 12, color: colors.neutral500, lineHeight: 1.5 }}
          >
            Scoring follows the CISA Zero Trust Maturity Model v2.0. Use the
            model as the rubric when picking an option.
          </Typography>
        </Box>
      </Box>
    </Card>
  )
}
