import * as React from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import OutlinedInput from '@mui/material/OutlinedInput'
import Typography from '@mui/material/Typography'
import Field, { fieldInputSx } from '@/components/ui/Field'
import {
  EXTENDED_METADATA_TITLE,
  EXTENDED_METADATA_CREATE_HINT,
  EXTENDED_METADATA_EDIT_HINT,
} from '@/constants'
import { colors } from '@/theme/tokens'
import { getFieldsBySection } from '@/views/SystemDetailPage/fieldConfig'
import type { FismaSystemType } from '@/types'

/** Props for {@link ExtendedMetadataFields}. */
export interface ExtendedMetadataFieldsProps {
  /** Draft system being edited; the value source for every input. */
  editedFismaSystem: FismaSystemType
  /** Draft setter; empty inputs write null so the load can backfill. */
  setEditedFismaSystem: React.Dispatch<React.SetStateAction<FismaSystemType>>
  /** 'create' or 'edit' - picks the hint line under the section title. */
  mode: string
}

/**
 * Extended Metadata section of the Add/Edit System modal - the twelve
 * onboarding-load fields (ISSO name, HVA, FIPS, system type, cloud info,
 * operator, owner, legacy flag). Rendered only for organization-wide
 * admins (the `extendedEditable` gate lives in the orchestrator); every
 * field is optional and an emptied input stores null so the onboarding
 * load can fill it in later.
 *
 * Field list and labels come from the shared fieldConfig `extended`
 * section, the same single source of truth the System Detail page and
 * the save-body key list use - a field added there renders here with no
 * modal changes.
 * @param {ExtendedMetadataFieldsProps} props - Draft + setter + mode.
 * @returns {JSX.Element} The bordered extended-metadata panel.
 */
export default function ExtendedMetadataFields({
  editedFismaSystem,
  setEditedFismaSystem,
  mode,
}: ExtendedMetadataFieldsProps) {
  const extendedFields = getFieldsBySection('extended')
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
        {extendedFields.map((field) => (
          <Grid item xs={12} sm={6} md={4} key={field.key}>
            <Field id={`${mode}-${field.key}`} label={field.label}>
              <OutlinedInput
                id={`${mode}-${field.key}`}
                fullWidth
                value={
                  (editedFismaSystem[field.key] as string | null | undefined) ??
                  ''
                }
                onChange={(e) => {
                  setEditedFismaSystem((prev) => ({
                    ...prev,
                    [field.key]: e.target.value || null,
                  }))
                }}
                sx={fieldInputSx}
              />
            </Field>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
