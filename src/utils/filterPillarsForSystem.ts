import { SAAS_EXCLUDED_PILLARS } from '@/constants'

/**
 * Hides pillars that aren't relevant to a system's scoring category.
 * Today only the 'SaaS' category triggers any filtering - Devices and
 * Applications are scored at the provider rather than the consumer for
 * SaaS systems (see {@link SAAS_EXCLUDED_PILLARS}). Every other category
 * passes through unchanged.
 *
 * Takes the resolved category string (not the raw `datacenterenvironment`)
 * so alias values map correctly - a system's raw value can be an alias
 * that resolves to a category via GET /api/v1/datacenterenvironments.
 * Callers resolve raw -> category and pass the primitive, which keeps a
 * stable value for a React effect's dependency array.
 *
 * Returns a new array and preserves the input order. Pass-through on
 * null/undefined/empty so callers don't have to short-circuit themselves
 * while the system info (or the category map) is still loading.
 *
 * @param pillars - The pillar names to filter (typically the output of
 *   {@link sortPillars}).
 * @param category - The system's resolved scoring category, or
 *   null/undefined while loading.
 * @returns A new array with category-irrelevant pillars removed.
 */
export function filterPillarsForSystem(
  pillars: string[],
  category: string | null | undefined
): string[] {
  if (category !== 'SaaS') return [...pillars]
  return pillars.filter(
    (p) => !(SAAS_EXCLUDED_PILLARS as readonly string[]).includes(p)
  )
}
