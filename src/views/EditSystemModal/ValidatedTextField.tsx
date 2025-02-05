import { useState, ChangeEvent } from 'react'
import { TextField } from '@mui/material'
import { useEffect, useRef } from 'react'
type ValidatedTextFieldProps = {
  label: string
  dfValue?: string
  isFullWidth?: boolean
  validator: (value: string) => string | false
  onChange: (isValid: boolean, value: string) => void
}
const ValidatedTextField: React.FC<ValidatedTextFieldProps> = ({
  label,
  validator,
  isFullWidth,
  dfValue,
  onChange,
}) => {
  const [value, setValue] = useState<string>(dfValue || '')
  const [error, setError] = useState<string | false>(false)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      const errorMessage = validator(dfValue || '')
      setError(errorMessage)
      onChange(!errorMessage, dfValue || '')
    }
  }, [dfValue, validator, onChange])
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const errorMessage = validator(newValue)
    setValue(newValue)
    setError(errorMessage)
    onChange(!errorMessage, newValue)
  }

  return (
    <TextField
      label={label}
      value={value}
      variant="standard"
      fullWidth={isFullWidth}
      margin="normal"
      onChange={handleChange}
      required
      InputLabelProps={{
        sx: {
          marginTop: 0,
        },
      }}
      error={!!error}
      helperText={error || ''}
    />
  )
}
export default ValidatedTextField
