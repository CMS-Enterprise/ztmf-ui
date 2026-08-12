import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Typography,
} from '@mui/material'
import {
  FismaSystemType,
  FormValidType,
  FormValidHelperText,
  DataCenterEnvironment,
} from '@/types'
import Field, { fieldInputSx } from '@/components/ui/Field'
import { StatusChip } from '@/components/ui/StatusChip'
import { optionalEmailValidator } from '@/views/EditSystemModal/validators'
import { toDropdownOptionsWithCurrent } from '@/utils/dataCenterEnvironments'
import {
  useSystemAttributes,
  optionsForField,
  booleanOptions,
  boolToSelectValue,
  selectValueToBool,
  isCrossFieldHidden,
} from '@/utils/systemMetadataVocab'
import type { SystemAttribute } from '@/types'
import { getTodayISO, MAX_NOTES_LENGTH } from '@/utils/decommission'
import SdlSyncToggle from '@/components/SdlSyncToggle/SdlSyncToggle'
import { colors, radius } from '@/theme/tokens'
import { EXTENDED_METADATA_SUBHEADER } from '@/constants'
import { getFieldsBySection, type FieldConfig } from './fieldConfig'

/**
 * In-page edit view for the System Detail page. Renders the card-grouped
 * layout the redesign mock specifies:
 *
 *   left column  -> System Identity (with status chip on the right)
 *   right column -> System Status, Data Lake Export, Organization (which
 *                   absorbs ISSO Email + Data Call Contact - the separate
 *                   Contacts card from the mock was a redundancy)
 *
 * Every input renders through the shared {@link Field} + {@link fieldInputSx}
 * shape so the visual treatment matches every other form in the app. Save /
 * Cancel actions live in the page header (the parent SystemDetailPage
 * swaps headerActions based on isEditing), so this component only owns the
 * body content. Columns end at their own natural heights (no flex
 * equalizer); the grid uses alignItems: flex-start.
 */
interface SystemDetailEditViewProps {
  system: FismaSystemType
  editedSystem: FismaSystemType
  formValid: FormValidType
  formValidErrorText: FormValidHelperText
  decommissionDate: string
  decommissionDateError: string
  decommissionNotes: string
  showDecommissionForm: boolean
  decommissionedByName: string
  reactivationNotes: string
  showReactivateForm: boolean
  reactivatedByName: string
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    key: string
  ) => void
  // Sets an extended field to its typed value: a string for enums/text, a
  // boolean|null for the tri-state booleans, or a string[] for the multi-select.
  onFieldChange: (
    key: string,
    value: string | boolean | string[] | null
  ) => void
  onValidatedFieldChange: (key: string, isValid: boolean, value: string) => void
  onDecommissionDateChange: (value: string) => void
  onDecommissionNotesChange: (value: string) => void
  onShowDecommissionForm: (show: boolean) => void
  onDecommissionRequest: () => void
  onReactivationNotesChange: (value: string) => void
  onShowReactivateForm: (show: boolean) => void
  onReactivateRequest: () => void
  validateDecommissionDate: (dateStr: string) => boolean
  onSdlSyncToggle: (checked: boolean) => void
  /**
   * Datacenter-environment vocabulary for the select field, passed down from
   * SystemDetailPage (which reads it from the outlet context).
   */
  datacenterEnvironments: DataCenterEnvironment[]
  /**
   * Target-maturity card, rendered between Data Lake Export and Organization,
   * matching the read view's placement.
   */
  targetMaturitySlot?: React.ReactNode
  /** Resolved OpDiv display name, shown read-only in the Organization card. */
  opdivName: string | null
}

/** Visual wrapper used by every card in the edit layout. */
function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.25,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography
          component="h2"
          sx={{ fontSize: 16, fontWeight: 700, color: colors.ink }}
        >
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  )
}

/** Single text input row inside the edit form. */
function TextRow({
  id,
  label,
  required,
  value,
  showError,
  errorText,
  onChange,
  disabled,
}: {
  id: string
  label: string
  required?: boolean
  value: string
  showError: boolean
  errorText: string
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void
  disabled?: boolean
}) {
  return (
    <Field
      id={id}
      label={label}
      required={required}
      error={showError ? errorText : undefined}
    >
      <OutlinedInput
        id={id}
        fullWidth
        value={value ?? ''}
        onChange={onChange}
        error={showError}
        disabled={disabled}
        sx={fieldInputSx}
      />
    </Field>
  )
}

/**
 * Optional email input: empty is fine, a non-empty value must be a
 * well-formed address. The validity feeds the page's formValid map so a bad
 * address gates Save the same way a hard-required field does, without
 * demanding a value (#674: required to create, not to edit).
 * @param {object} props - Component props.
 * @param {string} props.id - Input id (label htmlFor pairing).
 * @param {string} props.label - Visible label.
 * @param {string} props.fieldKey - The system field the input edits.
 * @param {string} props.value - Current draft value.
 * @param {(key: string, isValid: boolean, value: string) => void} props.onValidatedFieldChange
 *   - Validated setter from the page.
 * @returns {JSX.Element} The labelled input.
 */
function OptionalEmailRow({
  id,
  label,
  fieldKey,
  value,
  onValidatedFieldChange,
}: {
  id: string
  label: string
  fieldKey: string
  value: string
  onValidatedFieldChange: (key: string, isValid: boolean, value: string) => void
}) {
  // Local draft so an invalid keystroke still renders: the page's validated
  // setter only commits valid values to editedSystem, and binding the input
  // straight to that would freeze it mid-typo.
  const [draft, setDraft] = useState(value)
  const emailError = optionalEmailValidator(draft)
  return (
    <Field id={id} label={label} error={emailError || undefined}>
      <OutlinedInput
        id={id}
        fullWidth
        value={draft}
        error={Boolean(emailError)}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          onValidatedFieldChange(
            fieldKey,
            optionalEmailValidator(next) === false,
            next
          )
        }}
        sx={fieldInputSx}
      />
    </Field>
  )
}

export default function SystemDetailEditView(props: SystemDetailEditViewProps) {
  const {
    system,
    editedSystem,
    formValid,
    formValidErrorText,
    showDecommissionForm,
    decommissionedByName,
    decommissionDate,
    decommissionDateError,
    decommissionNotes,
    reactivationNotes,
    showReactivateForm,
    reactivatedByName,
    onInputChange,
    onFieldChange,
    onDecommissionDateChange,
    onDecommissionNotesChange,
    onShowDecommissionForm,
    onDecommissionRequest,
    onReactivationNotesChange,
    onShowReactivateForm,
    onReactivateRequest,
    validateDecommissionDate,
    onSdlSyncToggle,
    onValidatedFieldChange,
    datacenterEnvironments,
    targetMaturitySlot,
    opdivName,
  } = props

  const attributes = useSystemAttributes()
  // cloud_service_model and cloud_vendor do not apply to a non-cloud system;
  // hide them while cloud_system is No (crossFieldClears empties them on the
  // way out, so nothing hidden holds a stale value).
  const extendedFields = getFieldsBySection('extended').filter(
    (field) => !isCrossFieldHidden(field.key, editedSystem)
  )

  const requiredError = (key: keyof FormValidType): boolean => !formValid[key]
  const requiredErrorText = (key: keyof FormValidType): string =>
    formValidErrorText[key] ?? ''

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 1.75,
        // Columns end at their own natural heights. The flex equalizer is
        // intentionally NOT applied here.
        alignItems: 'flex-start',
      }}
    >
      {/* Left: System Identity */}
      <Card
        title="System Identity"
        action={
          <StatusChip
            label={system.decommissioned ? 'Decommissioned' : 'Active'}
            kind={system.decommissioned ? 'neutral' : 'active'}
          />
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextRow
            id="edit-fismaname"
            label="FISMA Name"
            required
            value={editedSystem.fismaname}
            showError={requiredError('fismaname')}
            errorText={requiredErrorText('fismaname')}
            onChange={(e) => onInputChange(e, 'fismaname')}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <TextRow
              id="edit-fismaacronym"
              label="FISMA Acronym"
              required
              value={editedSystem.fismaacronym}
              showError={requiredError('fismaacronym')}
              errorText={requiredErrorText('fismaacronym')}
              onChange={(e) => onInputChange(e, 'fismaacronym')}
            />
            <TextRow
              id="edit-groupacronym"
              label="Group Acronym"
              value={editedSystem.groupacronym ?? ''}
              showError={false}
              errorText=""
              onChange={(e) => onFieldChange('groupacronym', e.target.value)}
            />
          </Box>
          {/* Required to create, not to edit (#674): a CMS concept with no
              OpDiv equivalent, so unset on most non-CMS systems - a blank
              here must not freeze an unrelated edit. */}
          <TextRow
            id="edit-component"
            label="Component"
            value={editedSystem.component ?? ''}
            showError={false}
            errorText=""
            onChange={(e) => onFieldChange('component', e.target.value)}
          />
          <TextRow
            id="edit-groupname"
            label="Group Name"
            value={editedSystem.groupname ?? ''}
            showError={false}
            errorText=""
            onChange={(e) => onFieldChange('groupname', e.target.value)}
          />
          <TextRow
            id="edit-divisionname"
            label="Division Name"
            value={editedSystem.divisionname ?? ''}
            showError={false}
            errorText=""
            onChange={(e) => onFieldChange('divisionname', e.target.value)}
          />
          <TextRow
            id="edit-fismasubsystem"
            label="FISMA Subsystem"
            value={editedSystem.fismasubsystem ?? ''}
            showError={false}
            errorText=""
            onChange={(e) => onFieldChange('fismasubsystem', e.target.value)}
          />
        </Box>
      </Card>

      {/* Right column: stacked cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        <Card title="System Status">
          {system.decommissioned ? (
            !showDecommissionForm && !showReactivateForm ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {system.decommissioned_date && (
                  <Box>
                    <Typography
                      sx={{ fontSize: 12, color: colors.neutral500, mb: 0.25 }}
                    >
                      Decommissioned on
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: colors.ink }}>
                      {new Date(
                        system.decommissioned_date
                      ).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                {system.decommissioned_by && (
                  <Box>
                    <Typography
                      sx={{ fontSize: 12, color: colors.neutral500, mb: 0.25 }}
                    >
                      Decommissioned by
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: colors.ink }}>
                      {decommissionedByName || system.decommissioned_by}
                    </Typography>
                  </Box>
                )}
                {system.decommissioned_notes && (
                  <Box>
                    <Typography
                      sx={{ fontSize: 12, color: colors.neutral500, mb: 0.25 }}
                    >
                      Notes
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: colors.ink }}>
                      {system.decommissioned_notes}
                    </Typography>
                  </Box>
                )}
                {system.reactivated_date && (
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: colors.neutral500,
                      fontStyle: 'italic',
                    }}
                  >
                    Previously reactivated on{' '}
                    {new Date(system.reactivated_date).toLocaleDateString()}
                    {system.reactivated_by &&
                      ` by ${reactivatedByName || system.reactivated_by}`}
                    {system.reactivation_notes
                      ? ` (notes: ${system.reactivation_notes})`
                      : ''}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => onShowDecommissionForm(true)}
                  >
                    Edit decommission details
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={() => onShowReactivateForm(true)}
                  >
                    Reactivate system
                  </Button>
                </Box>
              </Box>
            ) : showDecommissionForm ? (
              <DecommissionEditForm
                decommissionDate={decommissionDate}
                decommissionDateError={decommissionDateError}
                decommissionNotes={decommissionNotes}
                onDecommissionDateChange={onDecommissionDateChange}
                onDecommissionNotesChange={onDecommissionNotesChange}
                validateDecommissionDate={validateDecommissionDate}
                primaryLabel="Update"
                onPrimary={() => {
                  if (validateDecommissionDate(decommissionDate)) {
                    onDecommissionRequest()
                  }
                }}
                onCancel={() => onShowDecommissionForm(false)}
              />
            ) : (
              <ReactivateEditForm
                reactivationNotes={reactivationNotes}
                onReactivationNotesChange={onReactivationNotesChange}
                onPrimary={onReactivateRequest}
                onCancel={() => onShowReactivateForm(false)}
              />
            )
          ) : (
            <Box>
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Checkbox
                    checked={showDecommissionForm}
                    onChange={(e) => onShowDecommissionForm(e.target.checked)}
                    sx={{
                      p: 0,
                      mr: 1,
                      color: colors.danger,
                      '&.Mui-checked': { color: colors.danger },
                    }}
                  />
                }
                label={
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: colors.ink,
                    }}
                  >
                    Decommission System
                  </Typography>
                }
              />
              {showDecommissionForm && (
                <Box sx={{ mt: 2, ml: 3.5 }}>
                  <DecommissionEditForm
                    decommissionDate={decommissionDate}
                    decommissionDateError={decommissionDateError}
                    decommissionNotes={decommissionNotes}
                    onDecommissionDateChange={onDecommissionDateChange}
                    onDecommissionNotesChange={onDecommissionNotesChange}
                    validateDecommissionDate={validateDecommissionDate}
                    primaryLabel="Decommission"
                    primaryColor="danger"
                    onPrimary={() => {
                      if (validateDecommissionDate(decommissionDate)) {
                        onDecommissionRequest()
                      }
                    }}
                    onCancel={() => onShowDecommissionForm(false)}
                  />
                </Box>
              )}
            </Box>
          )}
        </Card>

        <Card title="Data Lake Export">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography
                sx={{ fontSize: 13, fontWeight: 600, color: colors.ink }}
              >
                Sync to SDL (Snowflake)
              </Typography>
              <Typography
                sx={{ fontSize: 12, color: colors.neutral500, mt: 0.25 }}
              >
                Export this system and its scores to the CMS data lake nightly.
              </Typography>
            </Box>
            <SdlSyncToggle
              checked={editedSystem.sdl_sync_enabled ?? false}
              onChange={onSdlSyncToggle}
            />
          </Box>
        </Card>

        {targetMaturitySlot}

        {/* Organization. Absorbs ISSO Email + Data Call Contact - the
            separate Contacts card from the mock was redundant. */}
        <Card title="Organization">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextRow
              id="edit-opdiv"
              label="OpDiv"
              value={opdivName ?? ''}
              showError={false}
              errorText=""
              disabled
              onChange={() => {}}
            />
            {/* Required to create, not to edit (#674); a typed value is
                still format-checked and feeds formValid so a bad address
                gates Save. */}
            <OptionalEmailRow
              id="edit-datacallcontact"
              label="Data Call Contact"
              fieldKey="datacallcontact"
              value={editedSystem.datacallcontact ?? ''}
              onValidatedFieldChange={onValidatedFieldChange}
            />
            <OptionalEmailRow
              id="edit-issoemail"
              label="ISSO Email"
              fieldKey="issoemail"
              value={editedSystem.issoemail ?? ''}
              onValidatedFieldChange={onValidatedFieldChange}
            />
            <TextRow
              id="edit-fismauid"
              label="FISMA UID"
              required
              value={editedSystem.fismauid}
              showError={requiredError('fismauid')}
              errorText={requiredErrorText('fismauid')}
              onChange={(e) => onInputChange(e, 'fismauid')}
            />
            <Field
              id="edit-datacenterenvironment"
              label="Datacenter Environment"
              required
              error={
                requiredError('datacenterenvironment')
                  ? requiredErrorText('datacenterenvironment')
                  : undefined
              }
            >
              <Select
                id="edit-datacenterenvironment"
                fullWidth
                displayEmpty
                labelId="edit-datacenterenvironment-label"
                inputProps={{
                  'aria-labelledby': 'edit-datacenterenvironment-label',
                }}
                value={editedSystem.datacenterenvironment ?? ''}
                onChange={(e) =>
                  onInputChange(
                    {
                      target: { value: e.target.value as string },
                    } as React.ChangeEvent<HTMLInputElement>,
                    'datacenterenvironment'
                  )
                }
                input={<OutlinedInput sx={fieldInputSx} />}
                renderValue={(selected) => {
                  const v = (selected as string) || ''
                  if (!v)
                    return (
                      <Box component="span" sx={{ color: colors.neutral500 }}>
                        Select an environment
                      </Box>
                    )
                  return (
                    toDropdownOptionsWithCurrent(
                      datacenterEnvironments,
                      editedSystem.datacenterenvironment
                    ).find((o) => o.value === v)?.label ?? v
                  )
                }}
              >
                {toDropdownOptionsWithCurrent(
                  datacenterEnvironments,
                  editedSystem.datacenterenvironment
                ).map((option) => (
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
          </Box>
        </Card>
      </Box>

      {/* Extended Metadata - full width below both columns. Standard system
          attributes editable across all OpDivs. A field marked read-only in
          fieldConfig renders disabled. Each control stores its typed clear
          signal when emptied (enum '', boolean null, array []) so the save's
          dirty-diff can tell "clear this" from "leave unchanged". */}
      <Box sx={{ gridColumn: '1 / -1' }}>
        <Card title="Extended Metadata">
          <Typography
            sx={{ fontSize: 12, color: colors.neutral500, mt: -1.5, mb: 2 }}
          >
            {EXTENDED_METADATA_SUBHEADER}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                md: '1fr 1fr 1fr',
              },
              gap: 2,
            }}
          >
            {extendedFields.map((field) => (
              <ExtendedFieldControl
                key={field.key}
                field={field}
                editedSystem={editedSystem}
                attributes={attributes}
                onFieldChange={onFieldChange}
                onValidatedFieldChange={onValidatedFieldChange}
              />
            ))}
          </Box>
        </Card>
      </Box>
    </Box>
  )
}

/**
 * One extended-metadata input, rendered per its configured type: canonical
 * enum select, tri-state boolean (Yes/No/Unknown), decomposed multi-select,
 * validated email, or free text. Enum options come from the system-attributes
 * vocabulary; a field marked read-only in fieldConfig renders disabled.
 * @param {object} props - Component props.
 * @param {FieldConfig} props.field - The field to render.
 * @param {FismaSystemType} props.editedSystem - The draft being edited.
 * @param {SystemAttribute[]} props.attributes - Vocabulary rows for enums.
 * @param {(key: string, value: string | boolean | string[] | null) => void} props.onFieldChange
 *   - Typed setter; each control passes its per-type clear signal when emptied.
 * @param {(key: string, isValid: boolean, value: string) => void} props.onValidatedFieldChange
 *   - Setter for email fields, feeding the page's formValid map.
 * @returns {JSX.Element} The labelled input.
 */
function ExtendedFieldControl({
  field,
  editedSystem,
  attributes,
  onFieldChange,
  onValidatedFieldChange,
}: {
  field: FieldConfig
  editedSystem: FismaSystemType
  attributes: SystemAttribute[]
  onFieldChange: (
    key: string,
    value: string | boolean | string[] | null
  ) => void
  onValidatedFieldChange: (key: string, isValid: boolean, value: string) => void
}) {
  const id = `edit-${field.key}`
  const disabled = field.readOnly
  const selectAccessibility = {
    labelId: `${id}-label`,
    inputProps: { 'aria-labelledby': `${id}-label` },
  }
  if (field.type === 'select') {
    const current = editedSystem[field.key] as string | null | undefined
    return (
      <Field id={id} label={field.label} helperText={field.helpText}>
        <Select
          id={id}
          fullWidth
          displayEmpty
          disabled={disabled}
          value={current || ''}
          // enum clear signal is '' so the backend's blankToNil nulls it.
          onChange={(e) => onFieldChange(field.key, e.target.value)}
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
      </Field>
    )
  }
  if (field.type === 'boolean') {
    return (
      <Field id={id} label={field.label} helperText={field.helpText}>
        <Select
          id={id}
          fullWidth
          displayEmpty
          disabled={disabled}
          value={boolToSelectValue(
            editedSystem[field.key] as boolean | null | undefined
          )}
          // Unknown ('') maps to null - the boolean clear signal.
          onChange={(e) =>
            onFieldChange(field.key, selectValueToBool(e.target.value))
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
      </Field>
    )
  }
  if (field.type === 'multiselect') {
    const current =
      (editedSystem[field.key] as string[] | null | undefined) ?? []
    return (
      <Field id={id} label={field.label} helperText={field.helpText}>
        <Select
          id={id}
          fullWidth
          multiple
          disabled={disabled}
          value={current}
          // Deselecting all yields [] - the array clear signal.
          onChange={(e) =>
            onFieldChange(field.key, e.target.value as unknown as string[])
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
      </Field>
    )
  }
  const value = String(editedSystem[field.key] ?? '')
  // Optional email fields validate on content only: empty is fine, a
  // non-empty value must be a well-formed address. The validity feeds the
  // page's formValid map so a bad address gates Save the same way the
  // modal path does.
  const emailError =
    field.type === 'email' && !disabled ? optionalEmailValidator(value) : false
  return (
    <Field
      id={id}
      label={field.label}
      helperText={field.helpText}
      error={emailError || undefined}
    >
      <OutlinedInput
        id={id}
        fullWidth
        disabled={disabled}
        value={value}
        error={Boolean(emailError)}
        // Send the raw value, so clearing sends '' (the blankToNil clear
        // signal) rather than null, which the backend reads as "leave
        // unchanged".
        onChange={(e) => {
          const next = e.target.value
          if (field.type === 'email') {
            onValidatedFieldChange(
              field.key,
              optionalEmailValidator(next) === false,
              next
            )
          } else {
            onFieldChange(field.key, next)
          }
        }}
        sx={fieldInputSx}
      />
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-forms                                                          */
/* ------------------------------------------------------------------ */

function DecommissionEditForm({
  decommissionDate,
  decommissionDateError,
  decommissionNotes,
  onDecommissionDateChange,
  onDecommissionNotesChange,
  validateDecommissionDate,
  primaryLabel,
  primaryColor = 'primary',
  onPrimary,
  onCancel,
}: {
  decommissionDate: string
  decommissionDateError: string
  decommissionNotes: string
  onDecommissionDateChange: (value: string) => void
  onDecommissionNotesChange: (value: string) => void
  validateDecommissionDate: (dateStr: string) => boolean
  primaryLabel: string
  primaryColor?: 'primary' | 'danger'
  onPrimary: () => void
  onCancel: () => void
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Field
        id="decommission-date"
        label="Decommission Date"
        required
        error={decommissionDateError || undefined}
      >
        <OutlinedInput
          id="decommission-date"
          type="date"
          fullWidth
          value={decommissionDate}
          inputProps={{ max: getTodayISO() }}
          onChange={(e) => {
            onDecommissionDateChange(e.target.value)
            if (decommissionDateError) {
              validateDecommissionDate(e.target.value)
            }
          }}
          onBlur={(e) => validateDecommissionDate(e.currentTarget.value)}
          error={!!decommissionDateError}
          sx={fieldInputSx}
        />
      </Field>
      <Field
        id="decommission-notes"
        label="Notes (optional)"
        helperText={`${decommissionNotes.length} / ${MAX_NOTES_LENGTH}`}
      >
        <OutlinedInput
          id="decommission-notes"
          multiline
          minRows={3}
          fullWidth
          value={decommissionNotes}
          inputProps={{ maxLength: MAX_NOTES_LENGTH }}
          placeholder="Reason for decommission..."
          onChange={(e) => onDecommissionNotesChange(e.target.value)}
          sx={fieldInputSx}
        />
      </Field>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          color={primaryColor === 'danger' ? 'error' : 'primary'}
          size="small"
          onClick={onPrimary}
        >
          {primaryLabel}
        </Button>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  )
}

function ReactivateEditForm({
  reactivationNotes,
  onReactivationNotesChange,
  onPrimary,
  onCancel,
}: {
  reactivationNotes: string
  onReactivationNotesChange: (value: string) => void
  onPrimary: () => void
  onCancel: () => void
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Field
        id="reactivation-notes"
        label="Reactivation Notes (optional)"
        helperText={`${reactivationNotes.length} / ${MAX_NOTES_LENGTH}`}
      >
        <OutlinedInput
          id="reactivation-notes"
          multiline
          minRows={3}
          fullWidth
          value={reactivationNotes}
          inputProps={{ maxLength: MAX_NOTES_LENGTH }}
          placeholder="Reason for reactivation..."
          onChange={(e) => onReactivationNotesChange(e.target.value)}
          sx={fieldInputSx}
        />
      </Field>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={onPrimary}
        >
          Reactivate
        </Button>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  )
}
