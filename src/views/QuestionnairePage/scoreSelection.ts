// Pure helpers extracted from QuestionnairePage so the out-of-band scores re-seed
// and read-only draft eviction logic can be unit-tested in isolation, mirroring
// the saveGuard.ts pattern in this directory.

export interface ScoreEntry {
  notes: string
  scoreid: number
}

export type ScoreMap = Record<number, ScoreEntry>

export interface ScoreSelection {
  funcOptId: number // 0 when no option is answered
  choice: number // funcOptId, or the -1 "no answer" sentinel
  notes: string
  scoreid: number
}

/**
 * Derives the answered option for a question from its option values and the
 * scores map: the first option value present in the map wins. Mirrors how the
 * questionId effect seeds a question's answer, so the stale-scores re-seed and
 * its tests share one definition.
 */
export const deriveScoreSelection = (
  optionValues: number[],
  scores: ScoreMap
): ScoreSelection => {
  let funcOptId = 0
  for (const value of optionValues) {
    if (value in scores) {
      funcOptId = value
      break
    }
  }
  const entry = funcOptId ? scores[funcOptId] : undefined
  return {
    funcOptId,
    choice: funcOptId || -1,
    notes: entry ? entry.notes : '',
    scoreid: entry ? entry.scoreid : 0,
  }
}

export interface ReseedGuardState {
  hasQuestion: boolean
  loadingQuestion: boolean
  hasUnsavedEdits: boolean
  draftRestored: boolean
}

/**
 * Whether an out-of-band scores refresh may re-seed the current question's
 * answer. False while the question is loading (the questionId effect owns
 * seeding then), when there is no active question, when the user has unsaved
 * edits (never overwrite them), or when a draft was restored (the draft owns the
 * fields).
 */
export const shouldReseedAnswer = (s: ReseedGuardState): boolean =>
  s.hasQuestion && !s.loadingQuestion && !s.hasUnsavedEdits && !s.draftRestored
