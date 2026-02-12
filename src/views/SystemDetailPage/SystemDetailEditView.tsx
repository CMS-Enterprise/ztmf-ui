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
import { FismaSystemType, FormValidType, FormValidHelperText } from '@/types'
import { getFieldsBySection, FieldConfig } from './fieldConfig'
import ValidatedTextField from '@/views/EditSystemModal/ValidatedTextField'
import { emailValidator } from '@/views/EditSystemModal/validators'
import { datacenterenvironment } from '@/views/EditSystemModal/dataEnvironment'
import { getTodayISO, MAX_NOTES_LENGTH } from '@/utils/decommission'

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
  validateDecommissionDate: (dateStr: string) => boolean
}

function renderEditField(
  field: FieldConfig,
  props: SystemDetailEditViewProps
) {
  const {
    editedSystem,
    formValid,
    formValidErrorText,
    onInputChange,
    onValidatedFieldChange,
  } = props

  if (field.type === 'email') {
    return (
      <ValidatedTextField
        key={field.key}
        label={field.label}
        validator={emailValidator}
        dfValue={String(editedSystem[field.key] ?? '')}
        isFullWidth={true}
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
        error={!formValid[field.key]}
        helperText={!formValid[field.key] ? formValidErrorText[field.key] : ''}
        InputLabelProps={{ sx: { marginTop: 0 } }}
        sx={{ mt: 2 }}
        onChange={(e) => onInputChange(e, field.key)}
      >
        {datacenterenvironment.map((option) => (
          <MenuItem key={option.value} value={option.value}>
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

export default function SystemDetailEditView(props: SystemDetailEditViewProps) {
  const {
    system,
    showDecommissionForm,
    decommissionedByName,
    decommissionDate,
    onShowDecommissionForm,
    onDecommissionRequest,
    validateDecommissionDate,
  } = props
  const identityFields = getFieldsBySection('identity')
  const orgFields = getFieldsBySection('organization')
  const contactFields = getFieldsBySection('contacts')

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
      <Grid item xs={12} md={5}>
        {system.decommissioned ? (
          <Card
            variant="outlined"
            sx={{ mb: 3, borderColor: 'error.main' }}
          >
            <CardHeader
              title="System Status"
              titleTypographyProps={{ variant: 'h6' }}
              sx={{ pb: 0 }}
            />
            <CardContent>
              {!showDecommissionForm && (
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
                  <CmsButton
                    size="small"
                    onClick={() => onShowDecommissionForm(true)}
                    style={{ marginTop: '4px' }}
                  >
                    Edit Decommission Details
                  </CmsButton>
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
            </CardContent>
          </Card>
        ) : (
          <Card
            variant="outlined"
            sx={{ mb: 3 }}
          >
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
                    onChange={(e) =>
                      onShowDecommissionForm(e.target.checked)
                    }
                    sx={{
                      color: '#d32f2f',
                      '&.Mui-checked': { color: '#d32f2f' },
                    }}
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
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
        <Card variant="outlined">
          <CardHeader
            title="Organization"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            {orgFields.map((field) => renderEditField(field, props))}
          </CardContent>
        </Card>
      </Grid>

      {/* Contacts */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Contacts"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {contactFields.map((field) => renderEditField(field, props))}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
