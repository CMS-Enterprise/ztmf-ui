import { relativeTimeFrom } from '../helpers'

/** Props for {@link SubtitleLine}. */
export type SubtitleLineProps = {
  /** Number of questions the user has answered. */
  totalAnswered: number
  /** Total number of questions in the questionnaire. */
  totalQuestions: number
  /** Wall-clock time of the most recent local save. */
  lastSavedAt: Date | null
}

/**
 * Single-line subtitle under the Questionnaire page H1 that summarises
 * the current state: "42 of 147 questions answered · last saved 2 min
 * ago". Either half can be absent (no questions loaded yet, no save
 * recorded yet); the component drops missing pieces silently and returns
 * null when both are absent so the H1 doesn't pick up an orphan dot.
 * @param {SubtitleLineProps} props - Component props.
 * @returns {JSX.Element | null} The subtitle line or null when empty.
 */
export default function SubtitleLine({
  totalAnswered,
  totalQuestions,
  lastSavedAt,
}: SubtitleLineProps) {
  const parts: string[] = []
  if (totalQuestions > 0) {
    parts.push(`${totalAnswered} of ${totalQuestions} questions answered`)
  }
  if (lastSavedAt) {
    parts.push(`last saved ${relativeTimeFrom(lastSavedAt)}`)
  }
  if (parts.length === 0) return null
  return <span>{parts.join(' · ')}</span>
}
