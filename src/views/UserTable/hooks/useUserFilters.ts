import { useState } from 'react'

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
  const [search, setSearch] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all')
  const [opdivFilter, setOpDivFilter] = useState<number | 'all'>('all')
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
