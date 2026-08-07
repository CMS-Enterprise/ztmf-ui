import { FismaSystemType } from '@/types'

export type FieldSection = 'identity' | 'organization' | 'contacts' | 'extended'

export type FieldType = 'text' | 'email' | 'select' | 'multiselect' | 'boolean'

export interface FieldConfig {
  key: keyof FismaSystemType
  label: string
  section: FieldSection
  // Required to edit, not to create: true blocks the save while the field is
  // blank. Create-only requirements stay false here and are enforced in the
  // add-system modal.
  required: boolean
  type: FieldType
  // Display-only: rendered but never editable and excluded from the write
  // payload. For a value whose only writer is the backend.
  readOnly?: boolean
  // Short guidance shown under the control while editing. For a label that is
  // ambiguous or easily misread on its own, or a value whose write semantics
  // need saying at the point of edit. Rendered only when set; there is no
  // backend dependency, the copy lives here.
  helpText?: string
  // Overrides the Yes/No labels on a `boolean` field's tri-state control (and
  // its read-view text). For a field whose label reads ambiguously against a
  // plain Yes/No (e.g. a negatively-phrased label where "No" is a double
  // negative). Unknown stays Unknown.
  booleanLabels?: { true: string; false: string }
}

export const fieldConfigs: FieldConfig[] = [
  // Identity section (left column, md=7)
  {
    key: 'fismaname',
    label: 'FISMA Name',
    section: 'identity',
    required: true,
    type: 'text',
  },
  {
    key: 'fismaacronym',
    label: 'FISMA Acronym',
    section: 'identity',
    required: true,
    type: 'text',
  },
  {
    key: 'fismauid',
    label: 'FISMA UID',
    section: 'identity',
    required: true,
    type: 'text',
  },
  {
    key: 'fismasubsystem',
    label: 'FISMA Subsystem',
    section: 'identity',
    required: false,
    type: 'text',
  },
  {
    key: 'component',
    label: 'Component',
    // A CMS concept with no OpDiv equivalent, so unset on most non-CMS systems.
    section: 'identity',
    required: false,
    type: 'text',
  },
  {
    key: 'datacenterenvironment',
    label: 'Data Center Environment',
    section: 'identity',
    required: true,
    type: 'select',
  },

  // Organization section (right column, md=5)
  {
    key: 'groupacronym',
    label: 'Group Acronym',
    section: 'organization',
    required: false,
    type: 'text',
  },
  {
    key: 'groupname',
    label: 'Group Name',
    section: 'organization',
    required: false,
    type: 'text',
  },
  {
    key: 'divisionname',
    label: 'Division Name',
    section: 'organization',
    required: false,
    type: 'text',
  },

  // Contacts & Status section (full width)
  {
    key: 'issoemail',
    label: 'ISSO Email',
    // Required to create, not to edit: a system loaded without an ISSO must not
    // be frozen. A typed value is still format-checked.
    section: 'contacts',
    required: false,
    type: 'email',
  },
  {
    key: 'datacallcontact',
    label: 'Data Call Contact',
    // Not collected at onboarding, so unset on nearly every non-CMS system. A
    // typed value is still format-checked.
    section: 'contacts',
    required: false,
    type: 'email',
  },

  // Extended Metadata section. The system attributes below are writable only by
  // an unscoped admin; the backend restores the stored values over anything an
  // OpDiv-scoped admin sends for them. isso_name is the exception, writable by
  // any write admin: a stored value overrides the name the backend derives from
  // the ISSO user record, and the empty string clears it so the derived name
  // applies again.
  {
    key: 'isso_name',
    label: 'ISSO Name',
    section: 'extended',
    required: false,
    type: 'text',
    helpText:
      "A name entered here overrides the name from the ISSO's user account. Clear the field to show that name again.",
  },
  {
    key: 'hva',
    label: 'HVA',
    section: 'extended',
    required: false,
    type: 'boolean',
  },
  {
    key: 'fips',
    label: 'FIPS Impact Level',
    section: 'extended',
    required: false,
    type: 'select',
  },
  {
    key: 'system_type',
    label: 'System Type',
    section: 'extended',
    required: false,
    type: 'select',
  },
  {
    key: 'cloud_system',
    label: 'Cloud System',
    section: 'extended',
    required: false,
    type: 'boolean',
  },
  {
    key: 'cloud_service_model',
    label: 'Cloud Service Model',
    section: 'extended',
    required: false,
    type: 'multiselect',
  },
  {
    key: 'cloud_vendor',
    label: 'Cloud Vendor',
    section: 'extended',
    required: false,
    type: 'text',
  },
  {
    key: 'system_operator',
    label: 'System Operator',
    section: 'extended',
    required: false,
    type: 'select',
  },
  {
    key: 'goco_coco_gogo',
    label: 'GOCO/COCO/GOGO',
    section: 'extended',
    required: false,
    type: 'select',
  },
  {
    key: 'system_owner',
    label: 'System Owner',
    section: 'extended',
    required: false,
    type: 'text',
  },
  {
    key: 'system_owner_email',
    label: 'System Owner Email',
    section: 'extended',
    required: false,
    type: 'email',
  },
  {
    key: 'legacy',
    label: 'Legacy System',
    section: 'extended',
    required: false,
    type: 'boolean',
  },
]

export function getFieldsBySection(section: FieldSection): FieldConfig[] {
  return fieldConfigs.filter((f) => f.section === section)
}

// Single source of truth for the extended metadata write list. Derived from the
// `extended` section above (excluding read-only fields) so a field added to
// fieldConfig can't silently render-but-not-save, and a display-only field
// can't silently be written (the modal/detail PUT loops consume this).
export const EXTENDED_METADATA_KEYS: (keyof FismaSystemType)[] = fieldConfigs
  .filter((f) => f.section === 'extended' && !f.readOnly)
  .map((f) => f.key)
