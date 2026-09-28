import { useMemo } from 'react'
import { useContextProp } from '../../Title/Context'
import {
  buildOpDivCodeMap,
  buildOpDivLabelMap,
  buildAssignableOpDivs,
  narrowToCallerScope,
} from '../opdivDerivations'
import type { OpDiv, userData } from '@/types'

/**
 * Derives the OpDiv catalog the Users table needs from the shared context
 * list (Title fetches /opdivs once for every consumer, #701 - this hook no
 * longer fetches). One source list, four projections:
 *
 *   1. `opdivCodeMap` - id -> code for every OpDiv on file (incl. inactive /
 *      parent), so the OpDivs column resolves any granted id to a code.
 *   2. `opdivLabelMap` - id -> { code, name } for every OpDiv on file, so the
 *      grant modal can label grants to non-assignable OpDivs.
 *   3. `allAssignableOpDivs` - active, non-parent rows, NOT narrowed to the
 *      caller's scope; the grant modal narrows against the caller's fresh
 *      grants itself.
 *   4. `opdivOptions` - the caller-scoped subset for the inline OpDiv edit
 *      cell (narrowed to the actor's own OpDivs for an OpDiv tier). The
 *      server enforces the same rule.
 *
 * Empty projections when the actor is not an admin (read-only users never
 * see the grant modal) or before the shared list loads.
 * @param {boolean} isAdmin - Whether the actor can manage OpDiv grants.
 * @param {userData} userInfo - The actor's own profile; narrows the
 *   assignable subset for OpDivAdmins.
 * @returns {{ opdivOptions: OpDiv[], allAssignableOpDivs: OpDiv[],
 *   opdivCodeMap: Record<number, string>,
 *   opdivLabelMap: Record<number, { code: string, name: string }> }}
 *   The four projections; all empty until the shared list loads.
 */
export function useOpDivCatalog(
  isAdmin: boolean,
  userInfo: userData
): {
  opdivOptions: OpDiv[]
  allAssignableOpDivs: OpDiv[]
  opdivCodeMap: Record<number, string>
  opdivLabelMap: Record<number, { code: string; name: string }>
} {
  const { opdivs } = useContextProp()

  const opdivCodeMap = useMemo(() => buildOpDivCodeMap(opdivs), [opdivs])
  const opdivLabelMap = useMemo(() => buildOpDivLabelMap(opdivs), [opdivs])
  const allAssignableOpDivs = useMemo(
    () => buildAssignableOpDivs(opdivs, isAdmin),
    [opdivs, isAdmin]
  )
  const opdivOptions = useMemo(
    () => narrowToCallerScope(allAssignableOpDivs, userInfo),
    [allAssignableOpDivs, userInfo]
  )

  return { opdivOptions, allAssignableOpDivs, opdivCodeMap, opdivLabelMap }
}
