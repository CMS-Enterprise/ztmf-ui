import * as React from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import Field, { fieldInputSx } from '@/components/ui/Field'
import {
  EXTENDED_METADATA_TITLE,
  EXTENDED_METADATA_CREATE_HINT,
  EXTENDED_METADATA_EDIT_HINT,
} from '@/constants'
import { colors } from '@/theme/tokens'
import {
  getFieldsBySection,
  type FieldConfig,
} from '@/views/SystemDetailPage/fieldConfig'
import {
  useSystemAttributes,
  optionsForField,
  booleanOptions,
  boolToSelectValue,
  selectValueToBool,
  crossFieldClears,
  isCrossFieldHidden,
} from '@/utils/systemMetadataVocab'
import type { FismaSystemType } from '@/types'

/** Props for {@link ExtendedMetadataFields}. */
export interface ExtendedMetadataFieldsProps {
  /** Draft system being edited; the value source for every input. */
  editedFismaSystem: FismaSystemType
  /** Draft setter; each control stores its typed clear signal when emptied. */
  setEditedFismaSystem: React.Dispatch<React.SetStateAction<FismaSystemType>>
  /** 'create' or 'edit' - picks the hint line under the section title. */
  mode: string
}

/**
 * Extended Metadata section of the Add/Edit System modal - the onboarding-load
 * fields (ISSO name, HVA, FIPS, system type, cloud info, operator, owner,
 * legacy flag). Every field is optional and each control stores its typed
 * clear signal when emptied (enum '', boolean null, array []), matching the
 * backend's per-type clear semantics; the save sends a dirty-diff of only the
 * changed fields.
 *
 * Field list, labels, and control types come from the shared fieldConfig
 * `extended` section, the same single source of truth the System Detail page
 * and the save-body key list use - a field added there renders here with no
 * modal changes. Canonical enum options load from the system-attributes
 * vocabulary endpoint.
 * @param {ExtendedMetadataFieldsProps} props - Draft + setter + mode.
 * @returns {JSX.Element} The bordered extended-metadata panel.
 */
export default function ExtendedMetadataFields({
  editedFismaSystem,
  setEditedFismaSystem,
  mode,
}: ExtendedMetadataFieldsProps) {
  const extendedFields = getFieldsBySection('extended')
  const attributes = useSystemAttributes()

  const setField = (key: string, value: string | boolean | string[] | null) =>
    setEditedFismaSystem((prev) => ({
      ...prev,
      [key]: value,
      ...crossFieldClears(key, value),
    }))

  // Renders an extended-metadata field per its configured type: canonical
  // enum select, tri-state boolean (Yes/No/Unknown), decomposed multi-select,
  // or free text. A field marked read-only in fieldConfig renders disabled;
  // the same flag keeps it out of the write payload.
  const renderExtendedControl = (field: FieldConfig) => {
    const id = `${mode}-${field.key}`
    const disabled = field.readOnly
    const selectAccessibility = {
      labelId: `${id}-label`,
      inputProps: { 'aria-labelledby': `${id}-label` },
    }
    if (field.type === 'select') {
      const current = editedFismaSystem[field.key] as string | null | undefined
      return (
        <Select
          id={id}
          fullWidth
          displayEmpty
          disabled={disabled}
          value={current || ''}
          onChange={(e) => setField(field.key, e.target.value)}
          input={<OutlinedInput sx={fieldInputSx} />}
          renderValue={(selected) =>
            selected ? (
              (selected as string)
            ) : (
              <Box component="span" sx={{ color: colors.neutral500 }}>
                None
              </Box>
            )
          }
          {...selectAccessibility}
        >
          <MenuItem value="">None</MenuItem>
          {optionsForField(attributes, field.key).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      )
    }
    if (field.type === 'boolean') {
      return (
        <Select
          id={id}
          fullWidth
          displayEmpty
          disabled={disabled}
          value={boolToSelectValue(
            editedFismaSystem[field.key] as boolean | null | undefined
          )}
          onChange={(e) =>
            setField(field.key, selectValueToBool(e.target.value))
          }
          input={<OutlinedInput sx={fieldInputSx} />}
          {...selectAccessibility}
        >
          {booleanOptions(field.booleanLabels).map((o) => (
            <MenuItem key={o.label} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      )
    }
    if (field.type === 'multiselect') {
      const current =
        (editedFismaSystem[field.key] as string[] | null | undefined) ?? []
      return (
        <Select
          id={id}
          fullWidth
          multiple
          disabled={disabled}
          value={current}
          onChange={(e) =>
            setField(field.key, e.target.value as unknown as string[])
          }
          input={<OutlinedInput sx={fieldInputSx} />}
          renderValue={(selected) => (selected as string[]).join(', ')}
          {...selectAccessibility}
        >
          {optionsForField(attributes, field.key).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      )
    }
    return (
      <OutlinedInput
        id={id}
        fullWidth
        disabled={disabled}
        value={
          (editedFismaSystem[field.key] as string | null | undefined) ?? ''
        }
        // Send the raw value, so clearing sends '' (the blankToNil clear
        // signal) rather than null, which the backend reads as "leave
        // unchanged". Matches the detail edit view's text branch.
        onChange={(e) => setField(field.key, e.target.value)}
        sx={fieldInputSx}
      />
    )
  }

  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: 1,
      }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 0.5 }}>
        {EXTENDED_METADATA_TITLE}
      </Typography>
      <Typography
        sx={{
          display: 'block',
          mb: 2,
          fontSize: 12,
          color: colors.neutral500,
        }}
      >
        {mode === 'create'
          ? EXTENDED_METADATA_CREATE_HINT
          : EXTENDED_METADATA_EDIT_HINT}
      </Typography>
      <Grid container spacing={2}>
        {extendedFields
          .filter((field) => !isCrossFieldHidden(field.key, editedFismaSystem))
          .map((field) => (
            <Grid item xs={12} sm={6} md={4} key={field.key}>
              <Field
                id={`${mode}-${field.key}`}
                label={field.label}
                helperText={field.helpText}
              >
                {renderExtendedControl(field)}
              </Field>
            </Grid>
          ))}
      </Grid>
    </Box>
  )
}
