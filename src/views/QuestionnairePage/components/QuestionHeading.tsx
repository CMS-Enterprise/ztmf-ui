import Typography from '@mui/material/Typography'
import { colors } from '@/theme/tokens'
import EyebrowLine from './EyebrowLine'

/** Props for {@link QuestionHeading}. */
export type QuestionHeadingProps = {
  /** Pillar the question belongs to. */
  pillar: string
  /** Function the question asks about. */
  functionName: string
  /** 1-based position of the question within its pillar. */
  current: number
  /** Questions in the pillar. */
  total: number
  /** The question text. Empty while it loads. */
  question: string
  /** The function's description, shown under the question when set. */
  description: string
}

/**
 * The top of the question card: the "PILLAR · function · Q n of m" eyebrow,
 * the question as the card's h2 (under the PageHeader's h1, so screen-reader
 * users can jump straight to it), and the function's description.
 * @param {QuestionHeadingProps} props - Component props.
 * @returns {JSX.Element} The heading block.
 */
export default function QuestionHeading({
  pillar,
  functionName,
  current,
  total,
  question,
  description,
}: QuestionHeadingProps) {
  return (
    <>
      <EyebrowLine
        pillar={pillar}
        functionName={functionName}
        current={current}
        total={total}
      />
      <Typography
        component="h2"
        sx={{
          fontSize: 18,
          fontWeight: 700,
          color: colors.ink,
          mt: 0.75,
          mb: 0.5,
          lineHeight: 1.35,
        }}
      >
        {/* A space keeps the heading's height while the question loads. */}
        {question || ' '}
      </Typography>
      {description && (
        <Typography sx={{ fontSize: 13, color: colors.neutral500, mb: 2 }}>
          {description}
        </Typography>
      )}
    </>
  )
}
