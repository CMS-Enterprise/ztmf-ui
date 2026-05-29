import { PILLAR_FUNCTION_MAP } from '@/constants'
import { FismaQuestion } from '@/types'

const functionRank = (pillar: string, fnName: string): number => {
  const order = PILLAR_FUNCTION_MAP[pillar] ?? []
  const i = order.indexOf(fnName)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

export const sortFunctions = (
  pillar: string,
  steps: FismaQuestion[]
): FismaQuestion[] =>
  [...steps].sort(
    (a, b) =>
      functionRank(pillar, a.function.function) -
      functionRank(pillar, b.function.function)
  )
