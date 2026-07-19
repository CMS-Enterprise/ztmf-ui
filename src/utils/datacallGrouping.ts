import { sortDatacallsByDeadline } from './sortDatacallsByDeadline'

/**
 * Tenant that a data call belongs to. CMS runs quarterly calls (`FY## Q#`);
 * HHS OpDivs run an annual ZTM call (`FY## ZTM`). Names that do not match the
 * known grammar resolve to 'Other' so the selector can still display them
 * without guessing.
 */
export type DatacallTenant = 'CMS' | 'HHS' | 'Other'

/**
 * Grammar for a data-call name, mirroring the validator in DataCallModal.
 * `FY` + a 2- or 4-digit fiscal year + either a CMS quarter or the HHS `ZTM`
 * marker, e.g. `FY25 ZTM`, `FY2025 Q3`.
 */
const DATACALL_NAME_PATTERN = /^FY(\d{2}|\d{4}) (Q[1-4]|ZTM)$/

/**
 * Parse the fiscal year and tenant out of a data-call name. Year and tenant
 * are not stored fields, so they are derived from the name. A 2-digit year is
 * expanded to 20##; an unrecognized name yields `{ fiscalYear: null, tenant:
 * 'Other' }` rather than throwing.
 * @param {string} name - The data-call name (the `datacall` field).
 * @returns {{ fiscalYear: number | null; tenant: DatacallTenant }} Parsed parts.
 */
export function parseDatacallName(name: string): {
  fiscalYear: number | null
  tenant: DatacallTenant
} {
  const match = DATACALL_NAME_PATTERN.exec(name.trim())
  if (!match) {
    return { fiscalYear: null, tenant: 'Other' }
  }
  const [, yearToken, cadence] = match
  const fiscalYear =
    yearToken.length === 2 ? 2000 + Number(yearToken) : Number(yearToken)
  const tenant: DatacallTenant = cadence === 'ZTM' ? 'HHS' : 'CMS'
  return { fiscalYear, tenant }
}

/** A fiscal year and the data calls that belong to it. */
export type DatacallYearGroup<T> = {
  /** Fiscal year, or null for names that do not match the known grammar. */
  year: number | null
  calls: T[]
}

/**
 * Group data calls by fiscal year for the year-grouped selector. Years are
 * ordered most-recent first; calls within a year follow the deadline-based
 * order; the unparseable ('Other', year null) bucket sinks to the bottom.
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
      // Unparseable years (null) sink below every real year.
      if (a.year === null) return 1
      if (b.year === null) return -1
      return b.year - a.year
    })
}
