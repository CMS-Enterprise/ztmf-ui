import { useEffect, useState } from 'react'

/**
 * Canonical allowed values for the extended system-metadata fields
 * (ztmf-ui#460, frontend slice of ztmf#395).
 *
 * SWAP POINT: these values are hardcoded from the canonical set agreed on
 * ztmf#395 (2026-07-08) as a stopgap. The backend vocabulary endpoint that
 * serves them is ztmf#433 and is not built yet. When it ships, change ONLY
 * `fetchSystemMetadataVocab` below to read from it (mirroring
 * `fetchDataCenterEnvironments`) - the field configs, the edit views, and the
 * option helpers all consume the fetched result, so nothing else changes.
 *
 * `cloud_vendor` is deliberately absent: it is free text (out of scope on
 * ztmf#395). NULL/unset is always valid ("not yet captured") and is handled by
 * the option helpers, not by listing an empty value here.
 */

// The metadata fields that render as a single-value select.
export type MetadataSelectField =
  | 'fips'
  | 'system_type'
  | 'hva'
  | 'cloud_system'
  | 'goco_coco_gogo'
  | 'system_operator'
  | 'legacy'

// The one multi-select field. Stored as a sorted, slash-joined combo of the
// parts below (e.g. "IaaS/PaaS"); the helpers convert between the string and
// the parts array.
export type MetadataMultiSelectField = 'cloud_service_model'

export type SystemMetadataVocab = Record<
  MetadataSelectField | MetadataMultiSelectField,
  string[]
>

// Canonical set from ztmf#395. Order is the display order in the dropdown.
export const SYSTEM_METADATA_VOCAB: SystemMetadataVocab = {
  fips: ['High', 'Moderate', 'Low'],
  system_type: [
    'Major Application',
    'Minor Standalone',
    'Minor Application',
    'General Support System',
    'Enterprise',
    'Local',
    'Other',
  ],
  hva: ['Yes', 'No'],
  cloud_system: ['Yes', 'No'],
  goco_coco_gogo: ['GOCO', 'COCO', 'GOGO'],
  system_operator: ['Agency', 'Contractor'],
  legacy: ['Yes', 'No'],
  cloud_service_model: ['IaaS', 'PaaS', 'SaaS', 'Other'],
}

/**
 * Returns the metadata vocabulary. Currently resolves the hardcoded canonical
 * set; becomes a `GET` to the ztmf#433 endpoint when that lands (see SWAP
 * POINT above). Async so callers already await it and the swap is invisible.
 *
 * @param _signal - Reserved for the real fetch's AbortSignal; unused today.
 * @returns The allowed values per field.
 */
export async function fetchSystemMetadataVocab(
  _signal?: AbortSignal
): Promise<SystemMetadataVocab> {
  return SYSTEM_METADATA_VOCAB
}

/**
 * Reads the metadata vocabulary for a component. Seeded with the local
 * canonical set so selects render correctly on first paint, then refreshed
 * from `fetchSystemMetadataVocab` (a no-op today, a network read once ztmf#433
 * ships). Kept as a hook so every consumer gets the swap for free.
 *
 * @returns The current vocabulary.
 */
export function useSystemMetadataVocab(): SystemMetadataVocab {
  const [vocab, setVocab] = useState<SystemMetadataVocab>(SYSTEM_METADATA_VOCAB)
  useEffect(() => {
    const controller = new AbortController()
    fetchSystemMetadataVocab(controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) setVocab(v)
      })
      .catch(() => {
        // Non-fatal: fall back to the seeded canonical set.
      })
    return () => controller.abort()
  }, [])
  return vocab
}

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

/**
 * Single-select options for a field, preserving the system's current value
 * when it is not in the served set (a legacy/unmapped value). Without this,
 * editing such a system would show a blank select and drop the value on save.
 * The current value is appended as a disabled option so it renders and stays
 * valid but cannot be re-picked - the same pattern as
 * `toDropdownOptionsWithCurrent` for datacenter environments.
 *
 * @param allowed - Canonical values for the field.
 * @param current - The system's stored value (may be null/unset/legacy).
 * @returns Options in display order, with a trailing disabled legacy option
 *   when needed.
 */
export function toSelectOptionsWithCurrent(
  allowed: string[],
  current: string | null | undefined
): SelectOption[] {
  const options: SelectOption[] = allowed.map((v) => ({ value: v, label: v }))
  if (current && !allowed.includes(current)) {
    options.push({ value: current, label: current, disabled: true })
  }
  return options
}

/**
 * Splits a stored `cloud_service_model` combo into its parts. Tolerates the
 * legacy delimiters seen in the raw data (slash, comma, semicolon) so an
 * un-canonicalized value still populates the multi-select.
 *
 * @param value - The stored combo (e.g. "IaaS/PaaS"), possibly null.
 * @returns The parts, or an empty array when unset.
 */
export function parseCombo(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(/[/,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * Joins multi-select parts back into the stored combo: de-duplicated and
 * sorted so the same selection always serializes to the same string (the
 * canonical storage shape on ztmf#395). Empty selection serializes to null so
 * an unset value stays unset rather than becoming "".
 *
 * @param parts - The selected parts.
 * @returns The sorted slash-joined combo, or null when empty.
 */
export function serializeCombo(parts: string[]): string | null {
  const unique = Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean)))
  if (unique.length === 0) return null
  return unique.sort().join('/')
}

/**
 * Multi-select options for `cloud_service_model`: the canonical parts plus any
 * current part not in the canon (so a legacy combo's odd part still shows and
 * is not silently dropped on save).
 *
 * @param allowed - Canonical parts.
 * @param currentParts - Parts parsed from the stored value.
 * @returns The union, canonical parts first.
 */
export function multiSelectOptionsWithCurrent(
  allowed: string[],
  currentParts: string[]
): string[] {
  const extras = currentParts.filter((p) => !allowed.includes(p))
  return [...allowed, ...extras]
}
