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
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { FismaSystemType, FormValidType, FormValidHelperText } from '@/types'
import { getFieldsBySection, FieldConfig } from './fieldConfig'
import ValidatedTextField from '@/views/EditSystemModal/ValidatedTextField'
import { emailValidator } from '@/views/EditSystemModal/validators'
import { datacenterenvironment } from '@/views/EditSystemModal/dataEnvironment'

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
  getTodayISO: () => string
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
    getTodayISO,
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
        maxLength={500}
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
        {decommissionNotes.length}/500
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
            sx={{ pb: 0 }}
          />
          <CardContent>
            {identityFields.map((field) => renderEditField(field, props))}
          </CardContent>
        </Card>
      </Grid>

      {/* Organization */}
      <Grid item xs={12} md={5}>
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

      {/* Contacts & Status */}
      <Grid item xs={12}>
        <Card variant="outlined">
          <CardHeader
            title="Contacts & Status"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {contactFields.map((field) => renderEditField(field, props))}
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  {system.decommissioned ? (
                    <>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, mb: 1 }}
                      >
                        System Decommissioned
                      </Typography>
                      {!showDecommissionForm && (
                        <>
                          {system.decommissioned_date && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                ml: 2,
                                color: 'text.secondary',
                              }}
                            >
                              Date:{' '}
                              {new Date(
                                system.decommissioned_date
                              ).toLocaleDateString()}
                            </Typography>
                          )}
                          {system.decommissioned_by && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                ml: 2,
                                color: 'text.secondary',
                              }}
                            >
                              By:{' '}
                              {decommissionedByName || system.decommissioned_by}
                            </Typography>
                          )}
                          {system.decommissioned_notes && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                ml: 2,
                                mt: 0.5,
                                color: 'text.secondary',
                              }}
                            >
                              Notes: {system.decommissioned_notes}
                            </Typography>
                          )}
                          <CmsButton
                            size="small"
                            onClick={() => onShowDecommissionForm(true)}
                            style={{ marginTop: '8px' }}
                          >
                            Edit Decommission Details
                          </CmsButton>
                        </>
                      )}
                      {showDecommissionForm && (
                        <Box sx={{ ml: 2, mt: 1 }}>
                          <DecommissionDateNotesForm {...props} />
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <CmsButton
                              variation="solid"
                              size="small"
                              onClick={() => {
                                if (
                                  validateDecommissionDate(decommissionDate)
                                ) {
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
                    </>
                  ) : (
                    <>
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
                              if (
                                validateDecommissionDate(decommissionDate)
                              ) {
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
                    </>
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
