import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import { colors, fonts, radius } from '@/theme/tokens'
import type { FismaQuestion } from '@/types'
import Card from './Card'
import CisaReferenceCard from './CisaReferenceCard'
import { addSpace, type Category } from '../helpers'

/** Props for {@link SectionRail}. */
export type SectionRailProps = {
  /** Currently active pillar/category, or undefined while still loading. */
  category: Category | undefined
  /** functionid of the question the user is currently viewing. */
  selectedIndex: number
  /** Set of functionids that have an answered score row. */
  answeredFunctionIds: Set<number>
  /** Fired when the user picks a question in the section list. */
  onFunctionClick: (fn: FismaQuestion) => void
}

/**
 * Right rail of the Questionnaire page. Hosts the section's progress bar
 * (X of Y answered), the per-question list with an answer-state icon next
 * to each one, and the {@link CisaReferenceCard} below as a contextual
 * reference for scoring. When no category is loaded yet, renders a quiet
 * "Loading section..." card so the rail's slot doesn't collapse mid-load.
 * @param {SectionRailProps} props - Component props.
 * @returns {JSX.Element} The section rail.
 */
export default function SectionRail({
  category,
  selectedIndex,
  answeredFunctionIds,
  onFunctionClick,
}: SectionRailProps) {
  if (!category) {
    return (
      <Card sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          Loading section...
        </Typography>
      </Card>
    )
  }
  const sectionTotal = category.steps.length
  const sectionAnswered = category.steps.reduce(
    (acc, s) =>
      answeredFunctionIds.has(s.function.functionid) ? acc + 1 : acc,
    0
  )
  const fill = sectionTotal
    ? Math.min(1, sectionAnswered / sectionTotal) * 100
    : 0
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Card sx={{ p: 2 }}>
        <Typography
          sx={{ fontSize: 13, fontWeight: 700, color: colors.ink, mb: 0.25 }}
        >
          Section progress
        </Typography>
        <Typography sx={{ fontSize: 12, color: colors.neutral500, mb: 1 }}>
          {category.name === 'CrossCutting' ? 'Cross-cutting' : category.name}
        </Typography>
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 12,
            color: colors.neutral500,
            mb: 0.5,
          }}
        >
          {sectionAnswered} of {sectionTotal} answered
        </Typography>
        <Box
          sx={{
            height: 5,
            borderRadius: `${radius.sm}px`,
            backgroundColor: colors.neutral200,
            overflow: 'hidden',
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: `${fill}%`,
              height: '100%',
              backgroundColor: colors.primary,
            }}
          />
        </Box>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            color: colors.neutral500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            mb: 0.75,
          }}
        >
          Questions in this section
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {category.steps.map((fn, i) => {
            const isCurrent = fn.function.functionid === selectedIndex
            const isAnswered = answeredFunctionIds.has(fn.function.functionid)
            return (
              <Box
                key={fn.function.functionid}
                role="button"
                tabIndex={0}
                onClick={() => onFunctionClick(fn)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onFunctionClick(fn)
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 0.75,
                  py: 0.5,
                  borderRadius: `${radius.sm}px`,
                  cursor: 'pointer',
                  backgroundColor: isCurrent ? colors.primary50 : 'transparent',
                  color: isCurrent ? colors.ink900 : colors.ink,
                  '&:hover': {
                    backgroundColor: isCurrent
                      ? colors.primary50
                      : colors.neutral50,
                  },
                }}
              >
                {isCurrent ? (
                  <RadioButtonCheckedIcon
                    sx={{ fontSize: 14, color: colors.primary }}
                  />
                ) : isAnswered ? (
                  <CheckCircleIcon sx={{ fontSize: 14, color: colors.up }} />
                ) : (
                  <RadioButtonUncheckedIcon
                    sx={{ fontSize: 14, color: colors.neutral400 }}
                  />
                )}
                <Typography
                  sx={{
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    color: colors.neutral500,
                    minWidth: 24,
                  }}
                >
                  Q{i + 1}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: isCurrent ? 600 : 500,
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {addSpace(fn.function.function)}
                </Typography>
              </Box>
            )
          })}
        </Box>
        {sectionTotal === 0 && (
          <Typography sx={{ fontSize: 12, color: colors.neutral500, mt: 1 }}>
            No questions in this section.
          </Typography>
        )}
      </Card>
      <CisaReferenceCard />
    </Box>
  )
}
