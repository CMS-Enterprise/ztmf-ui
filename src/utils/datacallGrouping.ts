import { sortDatacallsByDeadline } from './sortDatacallsByDeadline'

/** A fiscal year and the data calls that belong to it. */
export type DatacallYearGroup<T> = {
  /** The stored fiscal year shared by every call in the group. */
  year: number
  calls: T[]
}

/**
 * Group data calls by their stored fiscal year for the year-grouped selector.
 * Years are ordered most-recent first; calls within a year follow the
 * deadline-based order. The title is never read: it is free text.
 * @param {T[]} calls - The data calls to group.
 * @returns {DatacallYearGroup<T>[]} Groups, newest year first.
 */
export function groupDatacallsByYear<
  T extends { fiscal_year: number; deadline: string; datacallid: number },
>(calls: T[]): DatacallYearGroup<T>[] {
  const byYear = new Map<number, T[]>()
  for (const call of calls) {
    const bucket = byYear.get(call.fiscal_year)
    if (bucket) {
      bucket.push(call)
    } else {
      byYear.set(call.fiscal_year, [call])
    }
  }

  return Array.from(byYear.entries())
    .map(([year, groupCalls]) => ({
      year,
      calls: sortDatacallsByDeadline(groupCalls),
    }))
    .sort((a, b) => b.year - a.year)
}
