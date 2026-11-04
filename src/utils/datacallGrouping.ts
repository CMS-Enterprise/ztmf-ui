import { sortDatacallsByDeadline } from './sortDatacallsByDeadline'

/**
 * How often a data call runs. A name whose next word after the fiscal year is
 * a quarter (`FY2025 Q3`) is quarterly; every other FY-prefixed name
 * (`FY25 ZTM`, `FY2027 Zero Trust Data Call`) is annual.
 */
export type DatacallCadence = 'annual' | 'quarterly'

/**
 * Fiscal-year prefix of a data-call name: `FY` + a 2- or 4-digit year that is
 * not followed by another digit, e.g. `FY25 ZTM`, `FY2025 Q3`,
 * `FY2027 Zero Trust Data Call`.
 */
const FISCAL_YEAR_PREFIX = /^FY(\d{4}|\d{2})(?!\d)/

/** A quarter as the first word after the fiscal year. */
const QUARTER_WORD = /^Q[1-4]\b/

/**
 * Parse the fiscal year and cadence out of a data-call name. Neither is a
 * stored field yet, so both are derived from the name. A 2-digit year is
 * expanded to 20##; a name without an FY prefix yields `{ fiscalYear: null,
 * cadence: null }` rather than throwing.
 * @param {string} name - The data-call name (the `datacall` field).
 * @returns {{ fiscalYear: number | null; cadence: DatacallCadence | null }}
 *   Parsed parts.
 */
export function parseDatacallName(name: string): {
  fiscalYear: number | null
  cadence: DatacallCadence | null
} {
  const trimmed = name.trim()
  const match = FISCAL_YEAR_PREFIX.exec(trimmed)
  if (!match) {
    return { fiscalYear: null, cadence: null }
  }
  const yearToken = match[1]
  const fiscalYear =
    yearToken.length === 2 ? 2000 + Number(yearToken) : Number(yearToken)
  const rest = trimmed.slice(match[0].length).trim()
  const cadence: DatacallCadence = QUARTER_WORD.test(rest)
    ? 'quarterly'
    : 'annual'
  return { fiscalYear, cadence }
}

/** A fiscal year and the data calls that belong to it. */
export type DatacallYearGroup<T> = {
  /** Fiscal year, or null for names without an FY prefix. */
  year: number | null
  calls: T[]
}

/**
 * Group data calls by fiscal year for the year-grouped selector. Years are
 * ordered most-recent first; calls within a year follow the deadline-based
 * order; the bucket of names without an FY prefix (year null) sinks to the
 * bottom.
 * @param {T[]} calls - The data calls to group.
 * @returns {DatacallYearGroup<T>[]} Groups, newest year first.
 */
export function groupDatacallsByYear<
  T extends { datacall: string; deadline: string; datacallid: number },
>(calls: T[]): DatacallYearGroup<T>[] {
  const byYear = new Map<number | null, T[]>()
  for (const call of calls) {
    const { fiscalYear } = parseDatacallName(call.datacall)
    const bucket = byYear.get(fiscalYear)
    if (bucket) {
      bucket.push(call)
    } else {
      byYear.set(fiscalYear, [call])
    }
  }

  return Array.from(byYear.entries())
    .map(([year, groupCalls]) => ({
      year,
      calls: sortDatacallsByDeadline(groupCalls),
    }))
    .sort((a, b) => {
      // Names without a year (null) sink below every real year.
      if (a.year === null) return 1
      if (b.year === null) return -1
      return b.year - a.year
    })
}
