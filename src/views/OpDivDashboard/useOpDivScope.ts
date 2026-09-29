/**
 * Who may open which OpDiv dashboard, and which OpDiv a URL resolves to.
 *
 * The pure helpers carry the rules so they can be pinned without rendering;
 * the hook only wires them to Outlet context. Display gating only - the
 * backend already narrows /fismasystems, /users and /scores to the caller, so
 * nothing here is a security boundary. What it prevents is subtler: /opdivs is
 * readable by any authenticated user, so an OpDiv-scoped admin can hand-type
 * another OpDiv's id and would otherwise get a fully-populated, entirely-zero
 * dashboard that reads as "this OpDiv has no systems".
 *
 * @module views/OpDivDashboard/useOpDivScope
 */
import { useMemo } from 'react'
import { useContextProp } from '../Title/Context'
import { narrowToCallerScope } from '@/views/UserTable/opdivDerivations'
import { hasAdminRead, hasUnscopedRead, isOpDivTier } from '@/utils/userRoles'
import type { FismaSystemType, OpDiv, userData } from '@/types'

const LAST_OPDIV_KEY = 'ztmf.lastOpDivId'

/**
 * URL segment for the aggregate view - every OpDiv the caller can see.
 *
 * A word rather than an id because it is not one: the aggregate applies no
 * OpDiv filter at all, which is the caller's whole server-scoped set.
 */
export const ALL_OPDIVS = 'all'

/** Resolution outcome for a `:opdivId` URL segment. */
export type OpDivScopeStatus = 'loading' | 'ok' | 'denied' | 'notfound'

/**
 * The OpDivs a user may switch between: active, and narrowed to their own
 * grants for OpDiv-scoped tiers. Unlike the grant picker this includes the
 * HHS parent row, which owns systems and so has a dashboard.
 * @param {userData} user - The acting user.
 * @param {OpDiv[]} opdivs - Full OpDiv list, including inactive rows.
 * @param {FismaSystemType[]} [systems] - Systems list, used only as a fallback
 *   scope source when an OpDiv-tier user has no grants array.
 * @returns {OpDiv[]} Switchable OpDivs, ordered by code.
 */
export function visibleOpDivs(
  user: userData,
  opdivs: OpDiv[],
  systems: FismaSystemType[] = []
): OpDiv[] {
  if (!hasAdminRead(user)) return []
  // Parent rows included: HHS is not a grantable tenant (buildAssignableOpDivs
  // excludes it for that reason) but it does own systems, so it has a
  // dashboard worth opening. Inactive rows stay out - they are not switchable,
  // though canViewOpDiv still resolves them by direct URL.
  const tenants = opdivs.filter((od) => od.active)
  // narrowToCallerScope is a no-op for unscoped tiers, so this one call covers
  // both the HHS/OWNER "see everything" case and the OpDiv-tier narrowing.
  const scoped = narrowToCallerScope(tenants, user)
  // Fallback for an OpDiv-tier user whose grants array is missing: derive the
  // scope from the systems list, which the server has already narrowed. An
  // empty grants array is a real answer (no grants) and is left alone.
  if (isOpDivTier(user) && user.assignedopdivids == null) {
    const fromSystems = new Set(
      systems.map((s) => s.opdiv_id).filter((id): id is number => id != null)
    )
    return tenants
      .filter((od) => fromSystems.has(od.opdiv_id))
      .sort((a, b) => a.code.localeCompare(b.code))
  }
  return [...scoped].sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Whether a user may view one OpDiv's dashboard. Deliberately wider than
 * {@link visibleOpDivs}: an inactive OpDiv is still readable by direct URL so
 * a just-deactivated tenant's numbers stay reachable, but an OpDiv-tier user
 * is still held to their grants.
 * @param {userData} user - The acting user.
 * @param {number} opdivId - The OpDiv being opened.
 * @param {FismaSystemType[]} [systems] - Fallback scope source, as above.
 * @returns {boolean} True when the dashboard may render.
 */
export function canViewOpDiv(
  user: userData,
  opdivId: number,
  systems: FismaSystemType[] = []
): boolean {
  if (!hasAdminRead(user)) return false
  if (hasUnscopedRead(user)) return true
  if (!isOpDivTier(user)) return false
  const granted = user.assignedopdivids
  if (granted == null) {
    return systems.some((s) => s.opdiv_id === opdivId)
  }
  return granted.includes(opdivId)
}

/**
 * Whether a caller's scope can only be resolved from the systems list.
 *
 * True for an OpDiv-tier user with no grants array, where the fallback above
 * reads scope out of the (already server-narrowed) systems. Callers must wait
 * for that list before deciding, or an empty in-flight list resolves to "no
 * access" and flashes a denial at a user who has it.
 * @param {userData} user - The acting user.
 * @returns {boolean} True when the systems list is required to decide.
 */
export function needsSystemsFallback(user: userData): boolean {
  return isOpDivTier(user) && user.assignedopdivids == null
}

/**
 * Parses a `:opdivId` segment against the full OpDiv list.
 *
 * Rejects 'manage' explicitly. React Router ranks the static /opdivs/manage
 * route above the dynamic sibling so this should be unreachable, but that is a
 * framework guarantee a future route reshuffle can break silently, and the
 * failure mode - the management path rendering an empty dashboard - is quiet.
 * @param {string | undefined} raw - The raw URL segment.
 * @param {OpDiv[]} opdivs - Full OpDiv list, including inactive rows.
 * @returns {OpDiv | null} The matching OpDiv, or null when unparseable/unknown.
 */
export function parseOpDivParam(
  raw: string | undefined,
  opdivs: OpDiv[]
): OpDiv | null {
  // 'all' is the aggregate sentinel, handled by the caller before this point;
  // rejected here too so it can never resolve to an OpDiv by accident.
  if (!raw || raw === 'manage' || raw === ALL_OPDIVS) return null
  // Number('') is 0 and Number(' 7 ') is 7; require a clean integer spelling
  // so '7abc' and '' cannot resolve.
  if (!/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return opdivs.find((od) => od.opdiv_id === id) ?? null
}

/**
 * Reads the last-viewed OpDiv id, ignoring one that is no longer visible.
 * @param {OpDiv[]} visible - The user's switchable OpDivs.
 * @returns {number | null} A still-valid remembered id, or null.
 */
export function readLastOpDivId(visible: OpDiv[]): number | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_OPDIV_KEY)
    if (!raw) return null
    const id = Number(raw)
    return visible.some((od) => od.opdiv_id === id) ? id : null
  } catch {
    // Private-mode / disabled storage: the sticky landing is a convenience,
    // never a requirement.
    return null
  }
}

/**
 * Remembers the OpDiv the user is looking at, for the next bare /opdivs visit.
 * @param {number} opdivId - The OpDiv now being viewed.
 * @returns {void}
 */
export function writeLastOpDivId(opdivId: number): void {
  try {
    window.sessionStorage.setItem(LAST_OPDIV_KEY, String(opdivId))
  } catch {
    // Ignored, as above.
  }
}

/**
 * Where a bare /opdivs should land: the remembered OpDiv when it is still
 * visible, else the first by code.
 * @param {OpDiv[]} visible - The user's switchable OpDivs.
 * @returns {OpDiv | null} The landing OpDiv, or null when there are none.
 */
export function preferredOpDiv(visible: OpDiv[]): OpDiv | null {
  if (visible.length === 0) return null
  const remembered = readLastOpDivId(visible)
  if (remembered != null) {
    return visible.find((od) => od.opdiv_id === remembered) ?? visible[0]
  }
  return visible[0]
}

/**
 * Whether a user has more than one OpDiv to aggregate over.
 *
 * With a single visible OpDiv the aggregate is that OpDiv, so offering it
 * would be two routes to the same page.
 * @param {OpDiv[]} visible - The user's switchable OpDivs.
 * @returns {boolean} True when an aggregate view is meaningful.
 */
export function canAggregate(visible: OpDiv[]): boolean {
  return visible.length > 1
}

/** What {@link useOpDivScope} returns. */
export type OpDivScope = {
  /** The switchable set, for the header dropdown. */
  visible: OpDiv[]
  /** The resolved target, or null unless status is 'ok'. */
  opdiv: OpDiv | null
  /** True when the page covers every OpDiv the caller can see. */
  isAggregate: boolean
  status: OpDivScopeStatus
}

/**
 * Resolves a `:opdivId` route param to an OpDiv the caller may view.
 * @param {string} [opdivIdParam] - The raw route param.
 * @returns {OpDivScope} The switchable set, resolved OpDiv and status.
 */
export function useOpDivScope(opdivIdParam?: string): OpDivScope {
  const { opdivs, opdivsLoaded, fismaSystems, fismaSystemsLoaded, userInfo } =
    useContextProp()

  return useMemo<OpDivScope>(() => {
    const visible = visibleOpDivs(userInfo, opdivs, fismaSystems)
    // Order matters. opdivs is [] during Title's first fetch, so resolving
    // before it settles would report notfound for every valid id - and when
    // scope has to come from the systems list, that list has to have settled
    // too, or a valid OpDiv briefly renders as a denial.
    const base = { visible, opdiv: null, isAggregate: false }
    if (
      !opdivsLoaded ||
      (needsSystemsFallback(userInfo) && !fismaSystemsLoaded)
    )
      return { ...base, status: 'loading' }
    if (!hasAdminRead(userInfo)) return { ...base, status: 'denied' }

    // The aggregate needs no per-OpDiv access check: it applies no filter, so
    // it shows exactly the systems the server already decided this caller may
    // see. It is withheld only when there is nothing to aggregate.
    if (opdivIdParam === ALL_OPDIVS) {
      return canAggregate(visible)
        ? { visible, opdiv: null, isAggregate: true, status: 'ok' }
        : { ...base, status: 'notfound' }
    }

    const opdiv = parseOpDivParam(opdivIdParam, opdivs)
    if (!opdiv) return { ...base, status: 'notfound' }
    if (!canViewOpDiv(userInfo, opdiv.opdiv_id, fismaSystems))
      return { ...base, status: 'denied' }
    return { visible, opdiv, isAggregate: false, status: 'ok' }
  }, [
    opdivs,
    opdivsLoaded,
    fismaSystems,
    fismaSystemsLoaded,
    userInfo,
    opdivIdParam,
  ])
}
