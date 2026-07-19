/**
 * Milliseconds for a data call's deadline, used as the sort key. An empty or
 * malformed deadline yields NaN from Date.parse; we coerce that to -Infinity
 * so a bad value sinks to the bottom instead of falling through to the
 * datacallid tiebreak (which would reintroduce the #393 "highest id wins" bug
 * for exactly the dirty historical records this ordering is meant to tame).
 */
function deadlineMs(dc: { deadline: string }): number {
  const t = new Date(dc.deadline).getTime()
  return Number.isNaN(t) ? -Infinity : t
}

/**
 * Orders data calls by deadline, furthest-out first, with datacallid as a
 * tiebreak. A re-imported historical data call can carry a higher datacallid
 * than the real current call, so id alone must not decide which call is
 * "latest" (#393). Returns a new array; the input is not mutated.
 */
export function sortDatacallsByDeadline<
  T extends { deadline: string; datacallid: number },
>(datacalls: T[]): T[] {
  return [...datacalls].sort(
    (a, b) => deadlineMs(b) - deadlineMs(a) || b.datacallid - a.datacallid
  )
}
