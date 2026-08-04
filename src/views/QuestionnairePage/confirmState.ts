import type { QuestionScores, ScoreStatus, FismaQuestion } from '@/types'

/**
 * Carried-forward confirmation state, derived from the persisted
 * scores.status column — the same fact the Data Call Progress fraction
 * counts — so the badge, Confirm button, sidebar markers, and Complete
 * summary can never disagree with the number the user is shown. Pure, so the
 * classification rules live in one place (mirrors saveGuard.ts).
 */

/**
 * The per-question classification every piece of confirmation UI reads.
 * 'none' covers: no answer row, a closed call (historical rows are
 * legitimately not_started forever), or a backend that does not serve status
 * yet (degrade to no badges rather than badging everything).
 */
export type CarryForwardState = 'unconfirmed' | 'updated' | 'none'

export const carryForwardState = (
  score: QuestionScores | undefined,
  isOpenCall: boolean
): CarryForwardState => {
  if (!isOpenCall || !score?.status) return 'none'
  return score.status === 'not_started' ? 'unconfirmed' : 'updated'
}

/**
 * Whether the inline Confirm button renders. It is the explicit act for an
 * untouched carried-forward answer, so it hides whenever another act owns the
 * write: dirty edits (Next saves those), a pending prior-response review (the
 * field is blanked; same condition that disables Next), or a read-only
 * session.
 */
export const canConfirmCarryForward = (s: {
  state: CarryForwardState
  dirty: boolean
  isReadOnly: boolean
  priorReviewBlocked: boolean
}): boolean =>
  s.state === 'unconfirmed' &&
  !s.dirty &&
  !s.isReadOnly &&
  !s.priorReviewBlocked

/**
 * Re-key the score map (keyed by functionoptionid) by owning functionid, so
 * the sidebar and Complete summary can look up a question's answer row
 * directly. Rows without functionoption cannot be attributed and are skipped.
 */
export const buildScoreByFunction = (scores: {
  [key: number]: QuestionScores
}): Record<number, QuestionScores> => {
  const byFunction: Record<number, QuestionScores> = {}
  for (const score of Object.values(scores)) {
    const functionid = score.functionoption?.functionid
    if (functionid != null) byFunction[functionid] = score
  }
  return byFunction
}

export type ConfirmSummaryEntry = {
  functionid: number
  functionName: string
  pillarName: string
}

export type ConfirmSummary = {
  /** Total questions in the questionnaire (the summary's denominator). */
  total: number
  /** Questions whose answer counts as updated this cycle (status = 'done'). */
  updated: number
  /** Carried-forward answers still awaiting confirmation, in sidebar order. */
  unconfirmed: ConfirmSummaryEntry[]
  /** Questions with no answer row at all, in sidebar order. */
  unanswered: ConfirmSummaryEntry[]
  /**
   * True when at least one row carries status. False = the backend does not
   * serve it, so the updated count and unconfirmed list would be lies built
   * from absence — callers must render neither. The unanswered list stays
   * valid (derived from row presence, not status).
   */
  hasStatusData: boolean
}

/**
 * Build the Complete-time summary from the sidebar's own category list, so
 * entries come out in sidebar order with sidebar names, ready for the same
 * slug-based navigation.
 */
export const buildConfirmSummary = (
  categories: { name: string; steps: FismaQuestion[] }[],
  scoreByFunction: Record<number, QuestionScores>,
  isOpenCall: boolean
): ConfirmSummary => {
  const summary: ConfirmSummary = {
    total: 0,
    updated: 0,
    unconfirmed: [],
    unanswered: [],
    hasStatusData: Object.values(scoreByFunction).some((s) => s.status != null),
  }
  for (const pillar of categories) {
    for (const step of pillar.steps) {
      summary.total++
      const functionid = step.function.functionid
      const score = scoreByFunction[functionid]
      if (!score) {
        summary.unanswered.push({
          functionid,
          functionName: step.function.function,
          pillarName: pillar.name,
        })
        continue
      }
      switch (carryForwardState(score, isOpenCall)) {
        case 'unconfirmed':
          summary.unconfirmed.push({
            functionid,
            functionName: step.function.function,
            pillarName: pillar.name,
          })
          break
        case 'updated':
          summary.updated++
          break
        // 'none' (no status served): answered, but neither confirmable nor
        // countable as updated — deliberately absent from every bucket.
      }
    }
  }
  return summary
}

export type { ScoreStatus }
