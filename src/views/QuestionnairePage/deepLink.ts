import { FismaSystemType, datacall } from '@/types'

// Slugify a pillar/function name for the questionnaire URL. Kept here (rather
// than inline in QuestionnairePage) so the deep-link resolvers below and the
// page's navigate() calls share one canonical definition.
export const toSlug = (str: string) =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll(' ', '-')

// Resolve the :fismaacronym URL param to a fismasystemid using the systems list
// the app already loads. Enables cold loads (paste / refresh / bookmark) where
// router location.state is empty. Case-insensitive; undefined when unresolved.
export function resolveSystemIdByAcronym(
  systems: FismaSystemType[],
  acronym: string | undefined
): number | undefined {
  if (!acronym) return undefined
  const target = acronym.toLowerCase()
  return systems.find((s) => s.fismaacronym?.toLowerCase() === target)
    ?.fismasystemid
}

// Resolve the URL's data-call segment back to its datacall. The segment is the
// call's name with spaces encoded as underscores (see how the page builds the
// URL), so undo that before matching. undefined when absent or unrecognized —
// callers fall back to the selected/latest call.
export function resolveDatacallBySlug(
  datacalls: datacall[],
  slug: string | undefined
): datacall | undefined {
  if (!slug) return undefined
  return datacalls.find((dc) => dc.datacall.replaceAll(' ', '_') === slug)
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
