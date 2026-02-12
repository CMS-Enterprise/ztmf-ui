import { FismaSystemType } from '@/types'

export type FieldSection = 'identity' | 'organization' | 'contacts'

export type FieldType = 'text' | 'email' | 'select'

export interface FieldConfig {
  key: keyof FismaSystemType
  label: string
  section: FieldSection
  required: boolean
  type: FieldType
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
]

export function getFieldsBySection(section: FieldSection): FieldConfig[] {
  return fieldConfigs.filter((f) => f.section === section)
}
