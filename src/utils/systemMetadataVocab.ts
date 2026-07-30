import { useEffect, useState } from 'react'
import axiosInstance from '@/axiosConfig'
import type { SystemAttribute, FismaSystemType } from '@/types'

/**
 * Backend-driven vocabulary for the extended system-metadata fields, from
 * GET /api/v1/systemattributes. Mirrors dataCenterEnvironments.ts: fetch the
 * rows, then derive per-field dropdown options client-side, so the server
 * stays the single source of truth for the allowed values.
 *
 * The endpoint returns one row per allowed value across every field; callers
 * narrow to a field with optionsForField. Enum fields (fips, system_type,
 * system_operator, goco_coco_gogo) and the cloud_service_model parts come from
 * here. The tri-state booleans (hva, cloud_system, legacy) are structural
 * Yes/No/Unknown, not a served list - see BOOLEAN_OPTIONS.
 */

/**
 * Fetches the full system-attribute vocabulary.
 *
 * @param signal - Optional AbortSignal to cancel the request.
 * @param selectableOnly - When true, asks the backend for dropdown options
 *   only (hides any non-selectable rows).
 * @returns Every attribute row (empty array when none).
 */
export async function fetchSystemAttributes(
  signal?: AbortSignal,
  selectableOnly = true
): Promise<SystemAttribute[]> {
  const res = await axiosInstance.get<{ data: SystemAttribute[] | null }>(
    '/systemattributes',
    { params: selectableOnly ? { selectable_only: true } : undefined, signal }
  )
  return res.data.data ?? []
}

/**
 * Reads the system-attribute vocabulary for a component: empty until the
 * fetch resolves (selects render their current value in the meantime), then
 * the served rows. Kept as a hook so each consumer gets it without threading.
 *
 * @returns The current attribute rows.
 */
export function useSystemAttributes(): SystemAttribute[] {
  const [rows, setRows] = useState<SystemAttribute[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetchSystemAttributes(controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setRows(r)
      })
      .catch(() => {
        // Non-fatal: an empty vocab just means no dropdown options yet.
      })
    return () => controller.abort()
  }, [])
  return rows
}

export type SelectOption = { value: string; label: string }

/**
 * Dropdown options for a single field: its selectable rows in display order.
 * Off-canon values can no longer be stored (the backend CHECK-constrains these
 * columns), so there is no legacy-value preservation to do.
 *
 * @param rows - All attribute rows from the endpoint.
 * @param field - The field key ("fips", "system_type", "cloud_service_model", ...).
 * @returns The field's options, ordered by `ordr`.
 */
export function optionsForField(
  rows: SystemAttribute[],
  field: string
): SelectOption[] {
  return rows
    .filter((r) => r.field === field && r.selectable)
    .sort((a, b) => a.ordr - b.ordr)
    .map((r) => ({ value: r.value, label: r.value }))
}

// Custom labels for the true/false ends of a tri-state boolean. For fields
// whose Yes/No reads ambiguously against the label (e.g. a negatively-phrased
// label where "No" would be a double negative). Unknown is always Unknown.
export type BooleanLabels = { true: string; false: string }

/**
 * Options for a tri-state boolean control. The select values are strings ('' for
 * Unknown) because a MUI Select value must be a string; boolToSelectValue /
 * selectValueToBool convert to and from the wire boolean|null.
 *
 * @param labels - Optional overrides for the true/false labels (Yes/No default).
 * @returns The three options in Yes/No/Unknown order.
 */
export function booleanOptions(labels?: BooleanLabels): SelectOption[] {
  return [
    { value: 'true', label: labels?.true ?? 'Yes' },
    { value: 'false', label: labels?.false ?? 'No' },
    { value: '', label: 'Unknown' },
  ]
}

// The default Yes/No/Unknown option set, for fields without custom labels.
export const BOOLEAN_OPTIONS: SelectOption[] = booleanOptions()

/**
 * Maps a tri-state boolean to its select value ('' = Unknown).
 */
export function boolToSelectValue(v: boolean | null | undefined): string {
  if (v === true) return 'true'
  if (v === false) return 'false'
  return ''
}

/**
 * Maps a boolean select value back to the wire boolean|null (Unknown -> null).
 */
export function selectValueToBool(v: string): boolean | null {
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}

/**
 * Display label for a tri-state boolean (read view / table).
 *
 * @param v - The value to format.
 * @param labels - Optional overrides for the true/false labels (Yes/No default),
 *   matching the field's edit-control options.
 * @returns The display label; Unknown when unset.
 */
export function formatBool(
  v: boolean | null | undefined,
  labels?: BooleanLabels
): string {
  if (v === true) return labels?.true ?? 'Yes'
  if (v === false) return labels?.false ?? 'No'
  return 'Unknown'
}

/**
 * Display label for a decomposed multi-select value.
 *
 * @param v - The stored parts, or null.
 * @returns The parts joined for display, or an em-dash when empty.
 */
export function formatList(v: string[] | null | undefined): string {
  return v && v.length > 0 ? v.join(', ') : '—'
}

/**
 * Whether two extended-field values are equal, for building a dirty-diff PUT.
 * Arrays compare order-insensitively (selection order is not meaningful);
 * null and undefined are treated as the same "unset". Used to send only the
 * fields the user actually changed - the backend reads an omitted field as
 * "leave unchanged" and the per-type clear signal (enum '', boolean null,
 * array []) as "clear".
 *
 * @param a - One value.
 * @param b - The other value.
 * @returns True when they represent the same stored value.
 */
/**
 * Builds the dirty-diff of extended-metadata fields for a write payload: every
 * field whose edited value differs from the baseline, at its typed value (an
 * unset value normalizes to null). Unchanged fields are omitted so the backend
 * leaves them untouched, while a per-type clear signal (enum '', boolean null,
 * array []) passes through as the user's clear. On create, pass an empty
 * baseline so only the fields the user set are sent.
 *
 * @param edited - The edited system.
 * @param baseline - The system to diff against (the loaded system, or an empty
 *   one when creating); a missing baseline treats every field as unset.
 * @param keys - The extended-metadata field keys to consider.
 * @returns A partial payload containing only the changed fields.
 */
export function buildExtendedDiff(
  edited: FismaSystemType,
  baseline: Partial<FismaSystemType> | null | undefined,
  keys: (keyof FismaSystemType)[]
): Partial<FismaSystemType> {
  const diff: Partial<FismaSystemType> = {}
  for (const key of keys) {
    if (!extendedFieldEqual(edited[key], baseline?.[key])) {
      ;(diff as Record<string, unknown>)[key] = edited[key] ?? null
    }
  }
  return diff
}

/**
 * Extra field clears that an extended-field edit forces on its dependents.
 * A system that is not a cloud system has no service model or vendor, so
 * setting cloud_system to No clears both to their per-type signal (array []
 * and enum ''). Merge the result into the edited system alongside the edit.
 *
 * @param key - The field being changed.
 * @param value - Its new value.
 * @returns The dependent fields to clear (empty when no cascade applies).
 */
export function crossFieldClears(
  key: string,
  value: unknown
): Partial<FismaSystemType> {
  if (key === 'cloud_system' && value === false) {
    return { cloud_service_model: [], cloud_vendor: '' }
  }
  return {}
}

/**
 * Whether a field is hidden by a cross-field rule given the current system
 * state. cloud_service_model and cloud_vendor only apply to cloud systems, so
 * they are hidden (and cleared by crossFieldClears) while cloud_system is No.
 *
 * @param key - The field to test.
 * @param system - The current edited system.
 * @returns True when the field should not be rendered.
 */
export function isCrossFieldHidden(
  key: string,
  system: Pick<FismaSystemType, 'cloud_system'>
): boolean {
  return (
    (key === 'cloud_service_model' || key === 'cloud_vendor') &&
    system.cloud_system === false
  )
}

export function extendedFieldEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? [...a].sort() : []
    const bb = Array.isArray(b) ? [...b].sort() : []
    return aa.length === bb.length && aa.every((v, i) => v === bb[i])
  }
  return (a ?? null) === (b ?? null)
}
