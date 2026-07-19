import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Tooltip,
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
import { getTodayISO, MAX_NOTES_LENGTH } from '@/utils/decommission'
import SdlSyncToggle from '@/components/SdlSyncToggle/SdlSyncToggle'
import { colors, radius } from '@/theme/tokens'
import {
  EXTENDED_METADATA_SUBHEADER,
  EXTENDED_METADATA_LOCK_TOOLTIP,
} from '@/constants'
import { getFieldsBySection } from './fieldConfig'

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
  onFieldChange: (key: string, value: string) => void
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
   * True for organization-wide admins: the Extended Metadata fields render
   * editable. Scoped tiers see the values populated but locked, with a
   * tooltip explaining the gate.
   */
  extendedEditable: boolean
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
    extendedEditable,
    datacenterEnvironments,
    targetMaturitySlot,
    opdivName,
  } = props

  const extendedFields = getFieldsBySection('extended')

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
            label="Fisma Name"
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
              label="Fisma Acronym"
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
          <TextRow
            id="edit-component"
            label="Component"
            required
            value={editedSystem.component}
            showError={requiredError('component')}
            errorText={requiredErrorText('component')}
            onChange={(e) => onInputChange(e, 'component')}
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
            label="Fisma Subsystem"
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
            <TextRow
              id="edit-datacallcontact"
              label="Data Call Contact"
              required
              value={editedSystem.datacallcontact ?? ''}
              showError={requiredError('datacallcontact')}
              errorText={requiredErrorText('datacallcontact')}
              onChange={(e) => onInputChange(e, 'datacallcontact')}
            />
            <TextRow
              id="edit-issoemail"
              label="ISSO Email"
              required
              value={editedSystem.issoemail ?? ''}
              showError={requiredError('issoemail')}
              errorText={requiredErrorText('issoemail')}
              onChange={(e) => onInputChange(e, 'issoemail')}
            />
            <TextRow
              id="edit-fismauid"
              label="Fisma UID"
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

      {/* Extended Metadata - full width below both columns. Inputs are
          disabled unless the caller is an organization-wide admin; scoped
          tiers see the values populated but locked, with a tooltip
          explaining the gate. isso_name is display-only (backend-resolved),
          so it renders disabled for everyone. */}
      <Box sx={{ gridColumn: '1 / -1' }}>
        <Card title="Extended Metadata">
          <Typography
            sx={{ fontSize: 12, color: colors.neutral500, mt: -1.5, mb: 2 }}
          >
            {extendedEditable
              ? EXTENDED_METADATA_SUBHEADER
              : EXTENDED_METADATA_LOCK_TOOLTIP}
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
            {extendedFields.map((field) => {
              const value = String(editedSystem[field.key] ?? '')
              const editable = extendedEditable && !field.readOnly
              // Optional email fields validate on content only: empty is
              // fine, a non-empty value must be a well-formed address. The
              // validity feeds the page's formValid map so a bad address
              // gates Save the same way the modal path does.
              const emailError =
                field.type === 'email' && editable
                  ? optionalEmailValidator(value)
                  : false
              const row = (
                <TextRow
                  id={`edit-${field.key}`}
                  label={field.label}
                  value={value}
                  showError={Boolean(emailError)}
                  errorText={emailError || ''}
                  disabled={!editable}
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
                />
              )
              // readOnly fields are locked for everyone (backend-resolved),
              // so the role-gate tooltip would be misleading on them.
              return extendedEditable || field.readOnly ? (
                <Box key={field.key}>{row}</Box>
              ) : (
                <Tooltip
                  key={field.key}
                  title={EXTENDED_METADATA_LOCK_TOOLTIP}
                  arrow
                  placement="top"
                >
                  <Box>{row}</Box>
                </Tooltip>
              )
            })}
          </Box>
        </Card>
      </Box>
    </Box>
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
