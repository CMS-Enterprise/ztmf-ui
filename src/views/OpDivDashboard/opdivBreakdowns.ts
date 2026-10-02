/**
 * Metadata breakdowns for the OpDiv dashboard's mini-charts.
 *
 * Two distinct shapes, kept as two types on purpose:
 *
 *  - {@link Breakdown} is a true partition - every system lands in exactly one
 *    bucket and the buckets sum to the total. Safe for a pie.
 *  - {@link OverlappingBreakdown} is not - a system can contribute to several
 *    buckets. Rendering it as a pie would claim a part-of-whole relationship
 *    that does not hold, so it carries a distinct type and an explicit
 *    denominator to keep the two from being swapped by accident.
 *
 * Every partition emits an Unknown bucket rather than dropping rows. The
 * metadata columns are all nullable and the booleans are genuinely tri-state,
 * so a missing value is a real answer ("nobody has recorded this") and folding
 * it into a populated bucket manufactures a fact.
 *
 * @module views/OpDivDashboard/opdivBreakdowns
 */
import type { ScoreTier } from '@/types'
import { NO_SCORE_LABEL, type OpDivSystemRow } from './opdivAggregates'

/** Label shown for a system whose value was never recorded. */
export const UNKNOWN_LABEL = 'Unknown'

/** One bucket of a breakdown. */
export type Bucket = { label: string; count: number }

/** A true partition: buckets sum to `total`. */
export type Breakdown = {
  buckets: Bucket[]
  total: number
}

/** Buckets that may double-count a system. Never render as a pie. */
export type OverlappingBreakdown = {
  buckets: Bucket[]
  /** Systems contributing to at least one bucket. */
  denominator: number
  /** Systems in scope for the question but with no value recorded. */
  unspecified: number
  readonly overlapping: true
}

/** Canonical display orders, so a bucket never moves between renders. */
const FIPS_ORDER = ['High', 'Moderate', 'Low']
const HOSTING_ORDER = ['Cloud', 'On-premises']
const OPERATING_MODEL_ORDER = ['GOCO', 'COCO', 'GOGO']
const SERVICE_MODEL_ORDER = ['SaaS', 'IaaS', 'PaaS', 'Other']
const STAGE_ORDER: string[] = [
  'Optimal',
  'Advanced',
  'Initial',
  'Traditional',
  'Not Assessed',
  NO_SCORE_LABEL,
]

/**
 * Partitions rows by a single-valued field.
 *
 * Buckets are emitted in `order`, then any unexpected values alphabetically,
 * then Unknown last. Unexpected values are surfaced rather than dropped: the
 * backend vocabulary can gain a value before the frontend knows about it, and
 * a silently-missing bucket is how a partition stops summing to its total.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @param {Function} pick - Maps a row to its bucket label, or null for unknown.
 * @param {string[]} [order] - Canonical bucket order.
 * @param {string} [unknownLabel] - Label for the null bucket.
 * @returns {Breakdown} A partition summing to rows.length.
 */
export function partitionBy(
  rows: OpDivSystemRow[],
  pick: (row: OpDivSystemRow) => string | null,
  order: string[] = [],
  unknownLabel: string = UNKNOWN_LABEL
): Breakdown {
  const counts = new Map<string, number>()
  let unknown = 0
  for (const row of rows) {
    const label = pick(row)
    if (label == null) {
      unknown += 1
      continue
    }
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const buckets: Bucket[] = order
    .filter((label) => counts.has(label))
    .map((label) => ({ label, count: counts.get(label) as number }))
  const extras = [...counts.keys()]
    .filter((label) => !order.includes(label))
    .sort((a, b) => a.localeCompare(b))
  for (const label of extras) {
    buckets.push({ label, count: counts.get(label) as number })
  }
  if (unknown > 0) buckets.push({ label: unknownLabel, count: unknown })

  return { buckets, total: rows.length }
}

/**
 * FIPS impact level. Values are title-case on the backend ('Low' | 'Moderate'
 * | 'High'), not the uppercase spelling used in some reports.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {Breakdown} FIPS partition.
 */
export function breakdownByFips(rows: OpDivSystemRow[]): Breakdown {
  return partitionBy(rows, (r) => r.system.fips ?? null, FIPS_ORDER)
}

/**
 * Cloud vs on-premises, from the tri-state `cloud_system` flag.
 *
 * A null is Unknown, never on-premises. There is no cloud/on-prem enum on the
 * backend - the distinction is carried by this boolean alongside
 * `datacenterenvironment` - so an unrecorded flag genuinely means nobody has
 * said, and defaulting it to on-premises would assert a hosting model.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {Breakdown} Hosting partition.
 */
export function breakdownByHosting(rows: OpDivSystemRow[]): Breakdown {
  return partitionBy(
    rows,
    (r) => {
      if (r.system.cloud_system === true) return 'Cloud'
      if (r.system.cloud_system === false) return 'On-premises'
      return null
    },
    HOSTING_ORDER
  )
}

/**
 * Government/contractor owned-operated split.
 *
 * The backend vocabulary is GOCO | COCO | GOGO only. A fourth "COGO" category
 * appears in some external reporting but has no representation here, so it is
 * deliberately absent rather than synthesized.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {Breakdown} Operating-model partition.
 */
export function breakdownByOperatingModel(rows: OpDivSystemRow[]): Breakdown {
  return partitionBy(
    rows,
    (r) => r.system.goco_coco_gogo ?? null,
    OPERATING_MODEL_ORDER
  )
}

/**
 * Maturity stage distribution.
 *
 * "No score" and "Not Assessed" are separate buckets. A system with no score
 * row was never enrolled in the call; one tiered Not Assessed was enrolled and
 * left unanswered. Merging them would report never-enrolled systems as
 * assessed-and-failing.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {Breakdown} Stage partition.
 */
export function breakdownByStage(rows: OpDivSystemRow[]): Breakdown {
  return partitionBy(
    rows,
    // Tier comes from the API; it is never re-derived from the score here.
    (r) => (r.tier ? (r.tier as ScoreTier) : NO_SCORE_LABEL),
    STAGE_ORDER
  )
}

/**
 * Cloud service models in use.
 *
 * `cloud_service_model` is a multi-select array, so a system running both IaaS
 * and PaaS contributes to two buckets and the counts sum to more than the
 * system total. Returned as an {@link OverlappingBreakdown} so it cannot be
 * passed to a part-of-whole chart by mistake.
 *
 * Scope is systems known to be cloud-hosted plus any system that records a
 * model regardless of the flag; `unspecified` counts cloud systems with no
 * model recorded.
 * @param {OpDivSystemRow[]} rows - The OpDiv's rows.
 * @returns {OverlappingBreakdown} Per-model counts.
 */
export function breakdownByServiceModel(
  rows: OpDivSystemRow[]
): OverlappingBreakdown {
  const counts = new Map<string, number>()
  let denominator = 0
  let unspecified = 0

  for (const row of rows) {
    const models = row.system.cloud_service_model ?? []
    if (models.length > 0) {
      denominator += 1
      // Dedupe within a system so a repeated value cannot inflate its bucket.
      for (const model of new Set(models)) {
        counts.set(model, (counts.get(model) ?? 0) + 1)
      }
      continue
    }
    // A cloud system with no model recorded is a gap worth naming. A non-cloud
    // or unknown-hosting system is simply out of scope for this question.
    if (row.system.cloud_system === true) unspecified += 1
  }

  const buckets: Bucket[] = SERVICE_MODEL_ORDER.filter((label) =>
    counts.has(label)
  ).map((label) => ({ label, count: counts.get(label) as number }))
  const extras = [...counts.keys()]
    .filter((label) => !SERVICE_MODEL_ORDER.includes(label))
    .sort((a, b) => a.localeCompare(b))
  for (const label of extras) {
    buckets.push({ label, count: counts.get(label) as number })
  }

  return { buckets, denominator, unspecified, overlapping: true }
}
