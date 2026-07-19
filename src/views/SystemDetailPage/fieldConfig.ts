import { FismaSystemType } from '@/types'

export type FieldSection = 'identity' | 'organization' | 'contacts' | 'extended'

export type FieldType = 'text' | 'email' | 'select'

export interface FieldConfig {
  key: keyof FismaSystemType
  label: string
  section: FieldSection
  required: boolean
  type: FieldType
  // Display-only: rendered but never editable and excluded from the write
  // payload. Used for values the backend resolves/owns (e.g. isso_name).
  readOnly?: boolean
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
    section: 'identity',
    required: true,
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
    section: 'contacts',
    required: true,
    type: 'email',
  },
  {
    key: 'datacallcontact',
    label: 'Data Call Contact',
    section: 'contacts',
    required: true,
    type: 'email',
  },

  // Extended Metadata section. Standard system attributes editable by any
  // write admin across all OpDivs. isso_name is the exception: the backend
  // resolves it (from the ISSO user record for CMS, from the import for HHS),
  // so it is display-only here and the edit form still edits issoemail.
  {
    key: 'isso_name',
    label: 'ISSO Name',
    section: 'extended',
    required: false,
    type: 'text',
    readOnly: true,
  },
  {
    key: 'hva',
    label: 'HVA',
    section: 'extended',
    required: false,
    type: 'text',
  },
  {
    key: 'fips',
    label: 'FIPS Impact Level',
    section: 'extended',
    required: false,
    type: 'text',
  },
  {
    key: 'system_type',
    label: 'System Type',
    section: 'extended',
    required: false,
    type: 'text',
  },
  {
    key: 'cloud_system',
    label: 'Cloud System',
    section: 'extended',
    required: false,
    type: 'text',
  },
  {
    key: 'cloud_service_model',
    label: 'Cloud Service Model',
    section: 'extended',
    required: false,
    type: 'text',
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
    type: 'text',
  },
  {
    key: 'goco_coco_gogo',
    label: 'GOCO/COCO/GOGO',
    section: 'extended',
    required: false,
    type: 'text',
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
    label: 'Legacy',
    section: 'extended',
    required: false,
    type: 'text',
  },
]

export function getFieldsBySection(section: FieldSection): FieldConfig[] {
  return fieldConfigs.filter((f) => f.section === section)
}

// Single source of truth for the extended metadata write list. Derived from the
// `extended` section above (excluding read-only fields like isso_name) so a
// field added to fieldConfig can't silently render-but-not-save, and a
// display-only field can't silently be written (the modal/detail PUT loops
// consume this).
export const EXTENDED_METADATA_KEYS: (keyof FismaSystemType)[] = fieldConfigs
  .filter((f) => f.section === 'extended' && !f.readOnly)
  .map((f) => f.key)
