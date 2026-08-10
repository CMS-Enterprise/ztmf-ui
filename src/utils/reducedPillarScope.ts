import type { datacall } from '@/types'

// Mirrors rolloverHardcodeTargetPrefixes in the backend's scores.go.
export const REDUCED_PILLAR_SCOPE_PREFIXES = ['FY2026', 'FY26'] as const

const isFY26Named = (name: string | undefined) =>
  REDUCED_PILLAR_SCOPE_PREFIXES.some((prefix) =>
    name?.trim().toUpperCase().startsWith(prefix)
  )

/**
 * Whether the reduced pillar scope (ztmf-misc#289) applies to a data call: true
 * for the FY26 cycle and every cycle after it.
 *
 * A threshold, not "is this the latest call" - latest-only would flip FY26 back
 * to the full question set once FY27 opened. Later cycles qualify by deadline,
 * never by datacallid, since ids are not chronological. Deliberately NOT "at or
 * after the earliest FY26 deadline": an FY26 call mis-dated before a closed cycle
 * would drag that cycle into scope and restate it.
 *
 * Returns false (the full set) whenever the answer is unknowable: showing an
 * extra pillar only over-discloses to the form's author, while hiding one loses
 * an answer.
 *
 * Mirrors saasPillarScopeSQL in the backend. Interim - phase 2 moves this into
 * the questions API.
 */
export function reducedPillarScopeApplies(
  datacalls: datacall[] | undefined,
  datacallid: number | undefined
): boolean {
  if (!datacalls?.length || !datacallid) return false

  const viewed = datacalls.find((d) => d.datacallid === datacallid)
  if (!viewed?.deadline) return false
  if (isFY26Named(viewed.datacall)) return true

  const lastFY26Deadline = datacalls
    .filter((d) => isFY26Named(d.datacall))
    .map((d) => new Date(d.deadline).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0]

  if (lastFY26Deadline === undefined) return false

  const viewedDeadline = new Date(viewed.deadline).getTime()
  if (Number.isNaN(viewedDeadline)) return false

  return viewedDeadline > lastFY26Deadline
}
