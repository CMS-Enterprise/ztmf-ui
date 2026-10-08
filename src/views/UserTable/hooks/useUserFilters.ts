import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Reads an initial OpDiv filter from `?opdiv=`, so the OpDiv dashboard can
 * deep-link into a pre-filtered roster.
 *
 * Anything unparseable falls back to 'all' rather than filtering to an id that
 * matches nothing - a hand-edited or stale link should show the full list, not
 * an empty table that reads as "no users".
 * @param {string | null} raw - The `opdiv` query param.
 * @returns {number | 'all'} The seed value for the OpDiv facet.
 */
function initialOpDivFilter(raw: string | null): number | 'all' {
  if (!raw || !/^\d+$/.test(raw)) return 'all'
  return Number(raw)
}

/**
 * Toolbar filter state for the Users table. Search applies as a controlled
 * quick-filter on the DataGrid (per-column matching for free); role and
 * OpDiv narrow the row set client-side so the existing /users response
 * shape stays unchanged. `showDeleted` round-trips to the load effect to
 * re-issue /users?deleted=...
 *
 * Grouped so the toolbar reads four setters from one source instead of
 * having the parent thread eight props down (controlled value + setter
 * for each filter).
 * @returns {{
 *   search: string,
 *   setSearch: (value: string) => void,
 *   roleFilter: string | 'all',
 *   setRoleFilter: (value: string | 'all') => void,
 *   opdivFilter: number | 'all',
 *   setOpDivFilter: (value: number | 'all') => void,
 *   showDeleted: boolean,
 *   setShowDeleted: (value: boolean) => void,
 *   quickFilterValues: string[] | undefined,
 * }} Controlled filter state plus the derived quickFilterValues passed
 *   to the DataGrid filterModel.
 */
export function useUserFilters() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all')
  // Seeded from the URL and re-seeded when the param changes (the route does
  // not remount, so a plain /users visit must clear an earlier deep link). The
  // URL is never rewritten, so the user is still free to widen the facet.
  const opdivParam = searchParams.get('opdiv')
  const [seededFrom, setSeededFrom] = useState(opdivParam)
  const [opdivFilter, setOpDivFilter] = useState<number | 'all'>(() =>
    initialOpDivFilter(opdivParam)
  )
  if (opdivParam !== seededFrom) {
    setSeededFrom(opdivParam)
    setOpDivFilter(initialOpDivFilter(opdivParam))
  }
  const [showDeleted, setShowDeleted] = useState<boolean>(false)

  const quickFilterValues = search.trim()
    ? search.trim().split(/\s+/)
    : undefined

  return {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    opdivFilter,
    setOpDivFilter,
    showDeleted,
    setShowDeleted,
    quickFilterValues,
  }
}
