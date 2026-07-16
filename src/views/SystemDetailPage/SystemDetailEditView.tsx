import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Box,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Chip,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import {
  FismaSystemType,
  FormValidType,
  FormValidHelperText,
  DataCenterEnvironment,
} from '@/types'
import { getFieldsBySection, FieldConfig } from './fieldConfig'
import ValidatedTextField from '@/views/EditSystemModal/ValidatedTextField'
import {
  emailValidator,
  optionalEmailValidator,
} from '@/views/EditSystemModal/validators'
import { toDropdownOptionsWithCurrent } from '@/utils/dataCenterEnvironments'
import { getTodayISO, MAX_NOTES_LENGTH } from '@/utils/decommission'
import SdlSyncToggle from '@/components/SdlSyncToggle/SdlSyncToggle'
import {
  EXTENDED_METADATA_TITLE,
  EXTENDED_METADATA_SUBHEADER,
} from '@/constants'

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
  // Datacenter-environment vocabulary for the select field, passed down from
  // SystemDetailPage (which reads it from the outlet context).
  datacenterEnvironments: DataCenterEnvironment[]
  // Rendered in the right column between Data Lake Export and Organization,
  // matching the read view's placement.
  targetMaturitySlot?: React.ReactNode
  opdivName: string | null
}

function renderEditField(
  field: FieldConfig,
  props: SystemDetailEditViewProps,
  disabled = false
) {
  const {
    editedSystem,
    formValid,
    formValidErrorText,
    onInputChange,
    onValidatedFieldChange,
    datacenterEnvironments,
  } = props

  if (field.type === 'email') {
    return (
      <ValidatedTextField
        key={field.key}
        label={field.label}
        validator={field.required ? emailValidator : optionalEmailValidator}
        required={field.required}
        dfValue={String(editedSystem[field.key] ?? '')}
        isFullWidth={true}
        disabled={disabled}
        onChange={(isValid, newValue) => {
          onValidatedFieldChange(field.key, isValid, newValue)
        }}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <TextField
        key={field.key}
        id={`edit-${field.key}`}
        select
        required={field.required}
        label={field.label}
        variant="standard"
        value={editedSystem[field.key] || ''}
        fullWidth
        disabled={disabled}
        error={!formValid[field.key]}
        helperText={!formValid[field.key] ? formValidErrorText[field.key] : ''}
        InputLabelProps={{ sx: { marginTop: 0 } }}
        sx={{ mt: 2 }}
        onChange={(e) => onInputChange(e, field.key)}
      >
        {toDropdownOptionsWithCurrent(
          datacenterEnvironments,
          editedSystem[field.key] as string | null | undefined
        ).map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    )
  }

  // Default: text field
  return (
    <TextField
      key={field.key}
      id={`edit-${field.key}`}
      label={field.label}
      required={field.required}
      fullWidth
      margin="normal"
      variant="standard"
      disabled={disabled}
      value={editedSystem[field.key] ?? ''}
      error={field.required && !formValid[field.key]}
      helperText={
        field.required && !formValid[field.key]
          ? formValidErrorText[field.key]
          : ''
      }
      InputLabelProps={{ sx: { marginTop: 0 } }}
      onChange={(e) => {
        if (field.required) {
          onInputChange(e, field.key)
        } else {
          props.onFieldChange(field.key, e.target.value)
        }
      }}
    />
  )
}

function DecommissionDateNotesForm(props: SystemDetailEditViewProps) {
  const {
    decommissionDate,
    decommissionDateError,
    decommissionNotes,
    onDecommissionDateChange,
    onDecommissionNotesChange,
    validateDecommissionDate,
  } = props

  return (
    <>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
        Decommission Date
      </Typography>
      <input
        type="date"
        value={decommissionDate}
        max={getTodayISO()}
        onChange={(e) => {
          onDecommissionDateChange(e.target.value)
          if (decommissionDateError) {
            validateDecommissionDate(e.target.value)
          }
        }}
        onBlur={(e) => validateDecommissionDate(e.currentTarget.value)}
        style={{
          width: '100%',
          padding: '8px',
          fontSize: '14px',
          border: decommissionDateError
            ? '1px solid #d32f2f'
            : '1px solid #ccc',
          borderRadius: '4px',
          boxSizing: 'border-box',
        }}
      />
      {decommissionDateError && (
        <Typography
          variant="caption"
          sx={{ color: '#d32f2f', mt: 0.5, display: 'block' }}
        >
          {decommissionDateError}
        </Typography>
      )}
      <Typography variant="body2" sx={{ mt: 2, mb: 0.5, fontWeight: 500 }}>
        Notes (optional)
      </Typography>
      <textarea
        value={decommissionNotes}
        maxLength={MAX_NOTES_LENGTH}
        rows={3}
        onChange={(e) => onDecommissionNotesChange(e.target.value)}
        placeholder="Reason for decommission..."
        style={{
          width: '100%',
          padding: '8px',
          fontSize: '14px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
      >
        {decommissionNotes.length}/{MAX_NOTES_LENGTH}
      </Typography>
    </>
  )
}

function ReactivateNotesForm(props: SystemDetailEditViewProps) {
  const { reactivationNotes, onReactivationNotesChange } = props
  return (
    <>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
        Reactivation Notes (optional)
      </Typography>
      <textarea
        value={reactivationNotes}
        maxLength={MAX_NOTES_LENGTH}
        rows={3}
        onChange={(e) => onReactivationNotesChange(e.target.value)}
        placeholder="Reason for reactivation..."
        style={{
          width: '100%',
          padding: '8px',
          fontSize: '14px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
      >
        {reactivationNotes.length}/{MAX_NOTES_LENGTH}
      </Typography>
    </>
  )
}

export default function SystemDetailEditView(props: SystemDetailEditViewProps) {
  const {
    system,
    editedSystem,
    showDecommissionForm,
    decommissionedByName,
    decommissionDate,
    onShowDecommissionForm,
    onDecommissionRequest,
    showReactivateForm,
    reactivatedByName,
    onShowReactivateForm,
    onReactivateRequest,
    validateDecommissionDate,
    onSdlSyncToggle,
    targetMaturitySlot,
  } = props
  const identityFields = getFieldsBySection('identity')
  const orgFields = getFieldsBySection('organization')
  const contactFields = getFieldsBySection('contacts')
  const extendedFields = getFieldsBySection('extended')

  return (
    <Grid container spacing={3}>
      {/* System Identity */}
      <Grid item xs={12} md={7}>
        <Card variant="outlined">
          <CardHeader
            title="System Identity"
            titleTypographyProps={{ variant: 'h6' }}
            action={
              system.decommissioned ? (
                <Chip label="Decommissioned" color="error" size="small" />
              ) : (
                <Chip label="Active" color="success" size="small" />
              )
            }
            sx={{ pb: 0 }}
          />
          <CardContent>
            {identityFields.map((field) => renderEditField(field, props))}
          </CardContent>
        </Card>
      </Grid>

      {/* Right column: Decommission + Organization */}
      <Grid
        item
        xs={12}
        md={5}
        sx={{ display: 'flex', flexDirection: 'column' }}
      >
        {system.decommissioned ? (
          <Card variant="outlined" sx={{ mb: 3, borderColor: 'error.main' }}>
            <CardHeader
              title="System Status"
              titleTypographyProps={{ variant: 'h6' }}
              sx={{ pb: 0 }}
            />
            <CardContent>
              {!showDecommissionForm && !showReactivateForm && (
                <>
                  {system.decommissioned_date && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Decommissioned On
                      </Typography>
                      <Typography variant="body1">
                        {new Date(
                          system.decommissioned_date
                        ).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                  {system.decommissioned_by && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Decommissioned By
                      </Typography>
                      <Typography variant="body1">
                        {decommissionedByName || system.decommissioned_by}
                      </Typography>
                    </Box>
                  )}
                  {system.decommissioned_notes && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography variant="body1">
                        {system.decommissioned_notes}
                      </Typography>
                    </Box>
                  )}
                  {system.reactivated_date && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontStyle: 'italic',
                          color: 'text.secondary',
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
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: '4px' }}>
                    <CmsButton
                      size="small"
                      onClick={() => onShowDecommissionForm(true)}
                    >
                      Edit Decommission Details
                    </CmsButton>
                    <CmsButton
                      variation="solid"
                      size="small"
                      onClick={() => onShowReactivateForm(true)}
                    >
                      Reactivate System
                    </CmsButton>
                  </Box>
                </>
              )}
              {showDecommissionForm && (
                <Box sx={{ mt: 1 }}>
                  <DecommissionDateNotesForm {...props} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <CmsButton
                      variation="solid"
                      size="small"
                      onClick={() => {
                        if (validateDecommissionDate(decommissionDate)) {
                          onDecommissionRequest()
                        }
                      }}
                    >
                      Update
                    </CmsButton>
                    <CmsButton
                      size="small"
                      onClick={() => onShowDecommissionForm(false)}
                    >
                      Cancel
                    </CmsButton>
                  </Box>
                </Box>
              )}
              {showReactivateForm && (
                <Box sx={{ mt: 1 }}>
                  <ReactivateNotesForm {...props} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <CmsButton
                      variation="solid"
                      size="small"
                      onClick={onReactivateRequest}
                    >
                      Reactivate
                    </CmsButton>
                    <CmsButton
                      size="small"
                      onClick={() => onShowReactivateForm(false)}
                    >
                      Cancel
                    </CmsButton>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardHeader
              title="System Status"
              titleTypographyProps={{ variant: 'h6' }}
              sx={{ pb: 0 }}
            />
            <CardContent>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showDecommissionForm}
                    onChange={(e) => onShowDecommissionForm(e.target.checked)}
                    sx={{
                      color: '#d32f2f',
                      '&.Mui-checked': { color: '#d32f2f' },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Decommission System
                  </Typography>
                }
              />
              {showDecommissionForm && (
                <Box sx={{ ml: 4, mt: 1 }}>
                  <DecommissionDateNotesForm {...props} />
                  <CmsButton
                    variation="solid"
                    onClick={() => {
                      if (validateDecommissionDate(decommissionDate)) {
                        onDecommissionRequest()
                      }
                    }}
                    style={{
                      marginTop: '12px',
                      backgroundColor: '#d32f2f',
                    }}
                  >
                    Decommission
                  </CmsButton>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardHeader
            title="Data Lake Export"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <SdlSyncToggle
              checked={editedSystem.sdl_sync_enabled ?? false}
              onChange={onSdlSyncToggle}
            />
          </CardContent>
        </Card>
        {targetMaturitySlot}
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardHeader
            title="Organization"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <TextField
              id="edit-opdiv_id"
              label="OpDiv"
              variant="standard"
              fullWidth
              disabled
              margin="normal"
              InputLabelProps={{ shrink: true, sx: { marginTop: 0 } }}
              value={props.opdivName ?? ''}
            />
            {orgFields.map((field) => renderEditField(field, props))}
          </CardContent>
        </Card>
      </Grid>

      {/* Contacts — full width, fields horizontal */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Contacts"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              {contactFields.map((field) => (
                <Grid item xs={12} sm={6} key={field.key}>
                  {renderEditField(field, props)}
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Extended Metadata — full width, 3-col grid. Standard system
          attributes editable across all OpDivs. isso_name is display-only
          (backend-resolved), so it renders disabled. */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title={EXTENDED_METADATA_TITLE}
            titleTypographyProps={{ variant: 'h6' }}
            subheader={EXTENDED_METADATA_SUBHEADER}
            subheaderTypographyProps={{ variant: 'caption' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              {extendedFields.map((field) => (
                <Grid item xs={12} sm={6} md={4} key={field.key}>
                  {renderEditField(field, props, field.readOnly)}
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
