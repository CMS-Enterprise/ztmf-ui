import type { datacall } from '@/types'

// Mirrors rolloverHardcodeTargetPrefixes in the backend's scores.go.
export const REDUCED_PILLAR_SCOPE_PREFIXES = ['FY2026', 'FY26'] as const

/**
 * Whether the reduced pillar scope (ztmf-misc#289) applies to a data call: true
 * for the FY26 cycle and everything after it.
 *
 * A threshold, not "is this the latest call" - latest-only would flip FY26 back
 * to the full question set once FY27 opened. Ordered by deadline, never by
 * datacallid, since ids are not chronological.
 *
 * Returns false (the full set) whenever the answer is unknowable: showing an
 * extra pillar only over-discloses to the form's author, while hiding one loses
 * an answer.
 *
 * Interim - phase 2 moves this into the questions API.
 */
export function reducedPillarScopeApplies(
  datacalls: datacall[] | undefined,
  datacallid: number | undefined
): boolean {
  if (!datacalls?.length || !datacallid) return false

  const viewed = datacalls.find((d) => d.datacallid === datacallid)
  if (!viewed?.deadline) return false

  const anchorDeadline = datacalls
    .filter((d) =>
      REDUCED_PILLAR_SCOPE_PREFIXES.some((prefix) =>
        d.datacall?.toUpperCase().startsWith(prefix)
      )
    )
    .map((d) => new Date(d.deadline).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0]

  if (anchorDeadline === undefined) return false

  const viewedDeadline = new Date(viewed.deadline).getTime()
  if (Number.isNaN(viewedDeadline)) return false

  return viewedDeadline >= anchorDeadline
}
