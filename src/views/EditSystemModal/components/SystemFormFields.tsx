import * as React from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Field, { fieldInputSx } from '@/components/ui/Field'
import SdlSyncToggle from '@/components/SdlSyncToggle/SdlSyncToggle'
import { TEXTFIELD_HELPER_TEXT } from '@/constants'
import { colors } from '@/theme/tokens'
import type {
  FismaSystemType,
  FormValidType,
  FormValidHelperText,
} from '@/types'
import { emailValidator } from '../validators'
import type { DataCenterEnvironmentOption } from '@/utils/dataCenterEnvironments'
import type { OpDiv } from '@/types'

/** Props for {@link SystemFormFields}. */
export interface SystemFormFieldsProps {
  /** Draft system being edited; the controlled value source for every input. */
  editedFismaSystem: FismaSystemType
  /** Direct setter for non-required fields (group/division/subsystem/sdl). */
  setEditedFismaSystem: React.Dispatch<React.SetStateAction<FismaSystemType>>
  /** Standard input change handler from useEditSystemForm. */
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    key: string
  ) => void
  /** True when a touched field is invalid; drives the red outline + helper text. */
  showError: (key: keyof FormValidType) => boolean
  /** Inline error map; rendered under each input when showError is true. */
  formValidErrorText: FormValidHelperText
  /** Mark a field as touched (used by the email / select handlers below). */
  markTouched: (key: string) => void
  /** Direct setter for the validity map (email / select bypass handleInputChange). */
  setFormValid: React.Dispatch<React.SetStateAction<FormValidType>>
  /** Direct setter for the inline error map (email / select). */
  setFormValidErrorText: React.Dispatch<
    React.SetStateAction<FormValidHelperText>
  >
  /**
   * OpDiv options for the required owning-OpDiv selector rendered at the
   * top of the form. Loaded by the orchestrator when the modal opens.
   */
  opdivs: OpDiv[]
  /**
   * Datacenter-environment options from the server vocabulary, including
   * the system's current value as a disabled entry when it is a legacy
   * environment that is no longer selectable.
   */
  datacenterEnvironmentOptions: DataCenterEnvironmentOption[]
  /**
   * Content rendered at the bottom of the right column, below the SDL
   * sync toggle. Used by EditSystemModal to render the decommission /
   * reactivate panel in edit mode so it appears in the same column as
   * the SDL sync toggle without leaking column-layout knowledge into
   * the orchestrator.
   */
  children?: React.ReactNode
}

/**
 * Two-column form for the FISMA system fields in EditSystemModal.
 * Left column: name + acronym/group-acronym pair + component +
 * group/division/subsystem. Right column: data-call-contact + ISSO email
 * + Fisma UID + datacenter-environment select + SDL sync toggle.
 *
 * Required fields use the shared {@link handleInputChange} from the form
 * hook. The two email inputs and the environment select have specialized
 * handlers (email format validation + select-style validity) so they
 * bypass handleInputChange and write through {@link markTouched},
 * {@link setFormValid}, and {@link setFormValidErrorText} directly.
 * @param {SystemFormFieldsProps} props - Form hook state + setters.
 * @returns {JSX.Element} The two-column grid of inputs.
 */
export default function SystemFormFields({
  editedFismaSystem,
  setEditedFismaSystem,
  handleInputChange,
  showError,
  formValidErrorText,
  markTouched,
  setFormValid,
  setFormValidErrorText,
  opdivs,
  datacenterEnvironmentOptions,
  children,
}: SystemFormFieldsProps) {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Field
          id="opdiv_id"
          label="OpDiv"
          required
          error={
            showError('opdiv_id') ? formValidErrorText.opdiv_id : undefined
          }
        >
          <Select
            id="opdiv_id"
            labelId="opdiv_id-label"
            fullWidth
            value={editedFismaSystem.opdiv_id ?? ''}
            error={showError('opdiv_id')}
            onChange={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value)
              markTouched('opdiv_id')
              setEditedFismaSystem((prev) => ({ ...prev, opdiv_id: val }))
              setFormValid((prev) => ({ ...prev, opdiv_id: val != null }))
            }}
            sx={{
              height: 38,
              fontSize: 14,
              '& fieldset': { borderColor: colors.border },
            }}
          >
            {opdivs.map((o) => (
              <MenuItem key={o.opdiv_id} value={o.opdiv_id}>
                {o.code} - {o.name}
              </MenuItem>
            ))}
          </Select>
        </Field>
      </Grid>
      <Grid item xs={12} md={6}>
        <Field
          id="fismaname"
          label="Fisma Name"
          required
          error={
            showError('fismaname') ? formValidErrorText.fismaname : undefined
          }
        >
          <OutlinedInput
            id="fismaname"
            fullWidth
            value={editedFismaSystem.fismaname || ''}
            error={showError('fismaname')}
            onChange={(e) =>
              handleInputChange(
                e as React.ChangeEvent<HTMLInputElement>,
                'fismaname'
              )
            }
            sx={fieldInputSx}
          />
        </Field>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Field
              id="fismaacronym"
              label="Fisma Acronym"
              required
              error={
                showError('fismaacronym')
                  ? formValidErrorText.fismaacronym
                  : undefined
              }
            >
              <OutlinedInput
                id="fismaacronym"
                fullWidth
                value={editedFismaSystem.fismaacronym || ''}
                error={showError('fismaacronym')}
                onChange={(e) =>
                  handleInputChange(
                    e as React.ChangeEvent<HTMLInputElement>,
                    'fismaacronym'
                  )
                }
                sx={fieldInputSx}
              />
            </Field>
          </Grid>
          <Grid item xs={6}>
            <Field id="groupacronym" label="Group Acronym">
              <OutlinedInput
                id="groupacronym"
                fullWidth
                value={editedFismaSystem.groupacronym || ''}
                onChange={(e) =>
                  setEditedFismaSystem((prev) => ({
                    ...prev,
                    groupacronym: e.target.value,
                  }))
                }
                sx={fieldInputSx}
              />
            </Field>
          </Grid>
        </Grid>

        <Field
          id="component"
          label="Component"
          required
          error={
            showError('component') ? formValidErrorText.component : undefined
          }
        >
          <OutlinedInput
            id="component"
            fullWidth
            value={editedFismaSystem.component || ''}
            error={showError('component')}
            onChange={(e) =>
              handleInputChange(
                e as React.ChangeEvent<HTMLInputElement>,
                'component'
              )
            }
            sx={fieldInputSx}
          />
        </Field>

        <Field id="groupname" label="Group Name">
          <OutlinedInput
            id="groupname"
            fullWidth
            value={editedFismaSystem.groupname || ''}
            onChange={(e) =>
              setEditedFismaSystem((prev) => ({
                ...prev,
                groupname: e.target.value,
              }))
            }
            sx={fieldInputSx}
          />
        </Field>

        <Field id="divisionname" label="Division Name">
          <OutlinedInput
            id="divisionname"
            fullWidth
            value={editedFismaSystem.divisionname || ''}
            onChange={(e) =>
              setEditedFismaSystem((prev) => ({
                ...prev,
                divisionname: e.target.value,
              }))
            }
            sx={fieldInputSx}
          />
        </Field>

        <Field id="fismasubsystem" label="Fisma Subsystem">
          <OutlinedInput
            id="fismasubsystem"
            fullWidth
            value={editedFismaSystem.fismasubsystem || ''}
            onChange={(e) =>
              setEditedFismaSystem((prev) => ({
                ...prev,
                fismasubsystem: e.target.value,
              }))
            }
            sx={fieldInputSx}
          />
        </Field>
      </Grid>

      <Grid item xs={12} md={6}>
        <Field
          id="datacallcontact"
          label="Data Call Contact"
          required
          error={
            showError('datacallcontact')
              ? formValidErrorText.datacallcontact
              : undefined
          }
        >
          <OutlinedInput
            id="datacallcontact"
            fullWidth
            value={editedFismaSystem.datacallcontact || ''}
            error={showError('datacallcontact')}
            onChange={(e) => {
              const value = e.target.value
              const result = emailValidator(value)
              const isValid = result === false
              markTouched('datacallcontact')
              setEditedFismaSystem((prev) => ({
                ...prev,
                datacallcontact: value,
              }))
              setFormValid((prev) => ({ ...prev, datacallcontact: isValid }))
              setFormValidErrorText((prev) => ({
                ...prev,
                datacallcontact: result || '',
              }))
            }}
            sx={fieldInputSx}
          />
        </Field>

        <Field
          id="issoemail"
          label="ISSO Email"
          required
          error={
            showError('issoemail') ? formValidErrorText.issoemail : undefined
          }
        >
          <OutlinedInput
            id="issoemail"
            fullWidth
            value={editedFismaSystem.issoemail || ''}
            error={showError('issoemail')}
            onChange={(e) => {
              const value = e.target.value
              const result = emailValidator(value)
              const isValid = result === false
              markTouched('issoemail')
              setEditedFismaSystem((prev) => ({ ...prev, issoemail: value }))
              setFormValid((prev) => ({ ...prev, issoemail: isValid }))
              setFormValidErrorText((prev) => ({
                ...prev,
                issoemail: result || '',
              }))
            }}
            sx={fieldInputSx}
          />
        </Field>

        <Field
          id="fismauid"
          label="Fisma UID"
          error={
            showError('fismauid') ? formValidErrorText.fismauid : undefined
          }
        >
          <OutlinedInput
            id="fismauid"
            fullWidth
            value={editedFismaSystem.fismauid || ''}
            error={showError('fismauid')}
            onChange={(e) =>
              handleInputChange(
                e as React.ChangeEvent<HTMLInputElement>,
                'fismauid'
              )
            }
            sx={fieldInputSx}
          />
        </Field>

        <Field
          id="datacenterenvironment"
          label="Datacenter Environment"
          required
          error={
            showError('datacenterenvironment')
              ? formValidErrorText.datacenterenvironment
              : undefined
          }
        >
          <Select
            id="datacenterenvironment"
            labelId="datacenterenvironment-label"
            fullWidth
            value={editedFismaSystem.datacenterenvironment || ''}
            error={showError('datacenterenvironment')}
            onChange={(e) => {
              const value = e.target.value as string
              markTouched('datacenterenvironment')
              setEditedFismaSystem((prev) => ({
                ...prev,
                datacenterenvironment: value,
              }))
              setFormValid((prev) => ({
                ...prev,
                datacenterenvironment: value.length > 0,
              }))
              if (value.length === 0) {
                setFormValidErrorText((prev) => ({
                  ...prev,
                  datacenterenvironment: TEXTFIELD_HELPER_TEXT,
                }))
              }
            }}
            sx={{
              height: 38,
              fontSize: 14,
              '& fieldset': { borderColor: colors.border },
            }}
          >
            {datacenterEnvironmentOptions.map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </Field>

        <Box
          sx={{
            mt: 3,
            p: 2,
            border: `1px solid ${colors.neutral200}`,
            borderRadius: 1,
          }}
        >
          <SdlSyncToggle
            checked={editedFismaSystem.sdl_sync_enabled ?? false}
            onChange={(checked) =>
              setEditedFismaSystem((prev) => ({
                ...prev,
                sdl_sync_enabled: checked,
              }))
            }
          />
        </Box>
        {children}
      </Grid>
    </Grid>
  )
}
