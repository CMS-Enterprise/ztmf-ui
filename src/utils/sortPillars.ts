import { PILLAR_ORDER } from '@/constants'

/**
 * Finds where a pillar sits in {@link PILLAR_ORDER}. Lower numbers come first.
 *
 * @param pillarName - The pillar name from the API (`question.pillar.pillar`).
 * @returns Where the pillar should sort.
 */
const pillarRank = (pillarName: string): number => {
  const orderIndex = PILLAR_ORDER.indexOf(pillarName)
  return orderIndex === -1 ? Number.MAX_SAFE_INTEGER : orderIndex
}

/**
 * Puts a list of pillar names in the fixed order (see {@link PILLAR_ORDER}:
 * Identity, Devices, Networks, Applications, Data, CrossCutting). Returns a
 * new array and leaves the original alone.
 *
 * @param pillarNames - The pillar names to sort.
 * @returns A new array of pillar names in the fixed order.
 */
export const sortPillars = (pillarNames: string[]): string[] =>
  [...pillarNames].sort(
    (pillarA, pillarB) => pillarRank(pillarA) - pillarRank(pillarB)
  )
