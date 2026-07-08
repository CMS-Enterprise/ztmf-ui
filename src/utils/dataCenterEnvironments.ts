import axiosInstance from '@/axiosConfig'
import type { DataCenterEnvironment } from '@/types'

/**
 * Fetches the datacenter-environment vocabulary from
 * GET /api/v1/datacenterenvironments.
 *
 * The endpoint is open to any authenticated user and returns every known
 * environment (selectable dropdown values plus legacy/alias values that
 * existing systems still resolve against), pre-ordered by `ordr`. We fetch
 * the full list once at the layout level and derive both the dropdown
 * options and the raw-to-category lookup from it client-side, so the
 * server stays the single source of truth for the vocabulary.
 */
export async function fetchDataCenterEnvironments(
  signal?: AbortSignal
): Promise<DataCenterEnvironment[]> {
  const response = await axiosInstance.get<{ data: DataCenterEnvironment[] }>(
    '/datacenterenvironments',
    { signal }
  )
  return response.data.data
}

export type DataCenterEnvironmentOption = {
  value: string
  label: string
  disabled?: boolean
}

/**
 * Dropdown options for the system form: only selectable environments,
 * labeled by their reporting category. Save still sends the raw
 * `datacenterenvironment` value. Input order is preserved (already sorted
 * by `ordr` from the API).
 */
export function toDropdownOptions(
  rows: DataCenterEnvironment[]
): DataCenterEnvironmentOption[] {
  return rows
    .filter((row) => row.selectable)
    .map((row) => ({ value: row.datacenterenvironment, label: row.category }))
}

/**
 * Dropdown options plus the system's current value when it is no longer
 * selectable (a legacy or alias environment that #394 marks
 * `selectable: false`). Without this, editing such a system would show a
 * blank required Select and log a MUI out-of-range warning. The current
 * value is appended as a disabled option so it renders and stays valid but
 * cannot be re-picked; the untouched raw value is still what gets saved.
 */
export function toDropdownOptionsWithCurrent(
  rows: DataCenterEnvironment[],
  currentValue: string | null | undefined
): DataCenterEnvironmentOption[] {
  const options = toDropdownOptions(rows)
  if (
    currentValue &&
    !options.some((option) => option.value === currentValue)
  ) {
    options.push({ value: currentValue, label: currentValue, disabled: true })
  }
  return options
}

/**
 * Lookup from a system's raw `datacenterenvironment` to its reporting
 * `category`, built from every row (including non-selectable aliases) so
 * legacy values resolve. Callers fall back to the raw value for anything
 * not in the map (e.g. before the fetch resolves).
 */
export function toCategoryMap(
  rows: DataCenterEnvironment[]
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.datacenterenvironment] = row.category
  }
  return map
}
