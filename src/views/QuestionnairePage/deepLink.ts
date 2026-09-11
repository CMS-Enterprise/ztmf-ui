import { FismaSystemType, datacall } from '@/types'

// Slugify a pillar/function name for the questionnaire URL. Kept here (rather
// than inline in QuestionnairePage) so the deep-link resolvers below and the
// page's navigate() calls share one canonical definition.
export const toSlug = (str: string) =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll(' ', '-')

// The questionnaire route is keyed on fismasystemid (#732). A purely numeric
// :fismasystemid segment is an id; anything else is a legacy acronym link
// (bookmarks and shared URLs from before the change) that the page redirects
// to the id form when it resolves to exactly one system.
export function parseSystemIdParam(
  param: string | undefined
): number | undefined {
  if (!param || !/^\d+$/.test(param)) return undefined
  return Number(param)
}

// Build the questionnaire path for a system, with the optional trailing
// datacall / pillar / function segments. Every link into the questionnaire
// (dashboard, System Info, breadcrumbs, in-survey nav, legacy redirect) goes
// through here so the URL shape has one definition.
export function questionnairePath(
  fismasystemid: number,
  ...segments: (string | undefined)[]
): string {
  const tail = segments.filter((s): s is string => !!s).join('/')
  return `/questionnaire/${fismasystemid}${tail ? `/${tail}` : ''}`
}

// Every system whose acronym matches the legacy acronym URL segment,
// case-insensitively. fismasystems.fismaacronym is not unique, so a slug can
// name more than one system.
export function findSystemsByAcronym(
  systems: FismaSystemType[],
  acronym: string | undefined
): FismaSystemType[] {
  if (!acronym) return []
  const target = acronym.toLowerCase()
  return systems.filter((s) => s.fismaacronym?.toLowerCase() === target)
}

// Resolve a legacy acronym URL segment to a fismasystemid using the systems
// list the app already loads, so pre-#732 bookmarks can redirect to the id
// form. Case-insensitive; undefined when unresolved or ambiguous: taking the
// first of several matches opened another system's questionnaire, and answers
// were saved against it.
export function resolveSystemIdByAcronym(
  systems: FismaSystemType[],
  acronym: string | undefined
): number | undefined {
  const matches = findSystemsByAcronym(systems, acronym)
  return matches.length === 1 ? matches[0].fismasystemid : undefined
}

// Encode a datacall name for its URL segment. Spaces become underscores (the
// long-standing URL convention), and a literal underscore is doubled first so
// names like "FY_2025 Q4" and "FY 2025_Q4" encode distinctly instead of
// colliding on FY_2025_Q4. Current names contain no underscores, so existing
// URLs are unchanged. Matching re-encodes each candidate name rather than
// decoding the slug, so the scheme only needs to be collision-free, not
// reversible.
export const encodeDatacallSlug = (name: string) =>
  name.replaceAll('_', '__').replaceAll(' ', '_')

// Resolve the URL's data-call segment back to its datacall by re-encoding each
// candidate name and comparing case-insensitively (consistent with the other
// resolvers — a case-mangled shared URL should still land on the right cycle,
// not silently fall back to the latest one). undefined when absent or
// unrecognized — callers fall back to the selected/latest call.
export function resolveDatacallBySlug(
  datacalls: datacall[],
  slug: string | undefined
): datacall | undefined {
  if (!slug) return undefined
  const target = slug.toLowerCase()
  return datacalls.find(
    (dc) => encodeDatacallSlug(dc.datacall).toLowerCase() === target
  )
}

export type FunctionTarget = {
  functionid: number
  pillarName: string
  functionName: string
}

// Structural shape of the page's Category so this module doesn't depend on the
// component. Matches { name, steps: FismaQuestion[] }.
type CategoryLike = {
  name: string
  steps: { function: { functionid: number; function: string } }[]
}

// Resolve the :pillar/:function URL params to a concrete function within the
// loaded categories, so a deep link opens the named question instead of always
// snapping to the first one. undefined when either param is missing or does not
// match any loaded pillar/function — callers fall back to categories[0].
export function resolveFunctionTarget(
  categories: CategoryLike[],
  pillarSlug: string | undefined,
  functionSlug: string | undefined
): FunctionTarget | undefined {
  if (!pillarSlug || !functionSlug) return undefined
  for (const cat of categories) {
    if (toSlug(cat.name) !== pillarSlug) continue
    for (const step of cat.steps) {
      if (toSlug(step.function.function) === functionSlug) {
        return {
          functionid: step.function.functionid,
          pillarName: cat.name,
          functionName: step.function.function,
        }
      }
    }
  }
  return undefined
}
