import { FismaQuestion } from '@/types'

/**
 * A pillar and the questions under it, in the order they render.
 */
export type Category = {
  name: string
  steps: FismaQuestion[]
}

/**
 * Groups a questionnaire payload by pillar, preserving the order the API sent.
 *
 * The order is the server's: `FindQuestionsByFismaSystem` sorts by
 * `pillars.ordr, questions.ordr, functions.ordr, questionid`, which keeps a
 * pillar's questions contiguous, so first appearance is that pillar's rank.
 * There is deliberately no sort here — this used to re-rank the payload through
 * two hardcoded maps keyed on pillar and function *names*, which dropped any
 * renamed or newly added function to the bottom of its pillar (ztmf-misc#393).
 *
 * @param questions - The questionnaire payload, in API order.
 * @returns One category per pillar, pillars and steps both in API order.
 */
export const groupQuestionsByPillar = (
  questions: FismaQuestion[]
): Category[] => {
  const categories: Category[] = []
  const byName = new Map<string, Category>()

  questions.forEach((question) => {
    const name = question.pillar.pillar
    let category = byName.get(name)
    if (!category) {
      category = { name, steps: [] }
      byName.set(name, category)
      categories.push(category)
    }
    category.steps.push(question)
  })

  return categories
}
