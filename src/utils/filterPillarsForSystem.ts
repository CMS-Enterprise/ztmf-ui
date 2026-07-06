import { SAAS_EXCLUDED_PILLARS } from '@/constants'

/**
 * Hides pillars that aren't relevant to a system's datacenter
 * environment. Today only 'SaaS' triggers any filtering - Devices and
 * Applications are scored at the provider rather than the consumer for
 * SaaS systems (see {@link SAAS_EXCLUDED_PILLARS}). Every other
 * environment passes through unchanged.
 *
 * Takes the env string directly (rather than the whole system object)
 * so callers can pass a stable primitive into a React effect's
 * dependency array without churn.
 *
 * Returns a new array and preserves the input order. Pass-through on
 * null/undefined/empty env so callers don't have to short-circuit
 * themselves while the system info is still loading.
 *
 * @param pillars - The pillar names to filter (typically the output of
 *   {@link sortPillars}).
 * @param datacenterenvironment - The system's
 *   `datacenterenvironment` value, or null/undefined while loading.
 * @returns A new array with environment-irrelevant pillars removed.
 */
export function filterPillarsForSystem(
  pillars: string[],
  datacenterenvironment: string | null | undefined
): string[] {
  if (datacenterenvironment !== 'SaaS') return [...pillars]
  return pillars.filter(
    (p) => !(SAAS_EXCLUDED_PILLARS as readonly string[]).includes(p)
  )
}
