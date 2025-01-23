import * as React from 'react'
import { GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid'
import { TextField } from '@mui/material'

interface CustomEditComponentProps extends GridRenderEditCellParams {
  getErrorValue: () => boolean
}

export default function EditInputCell(props: CustomEditComponentProps) {
  const { id, value, field, hasFocus, getErrorValue } = props
  const apiRef = useGridApiContext()
  const ref = React.useRef<HTMLElement>(null)

  React.useLayoutEffect(() => {
    if (hasFocus) {
      ref.current?.focus()
    }
  }, [hasFocus])

  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value // The new value entered by the user
    apiRef.current.setEditCellValue({ id, field, value: newValue })
    // console.log(apiRef.current.getRowWithUpdatedValues(id, field))
  }
  return (
    <TextField
      fullWidth
      inputRef={ref}
      error={getErrorValue()}
      label=""
      id="fullWidth"
      value={value}
      onChange={handleValueChange}
      sx={{
        // '& .MuiOutlinedInput-root': {
        //   '& fieldset': {
        //     border: 'none',
        //   },
        // },
        '& .MuiOutlinedInput-input': {
          py: 1.5,
          // pt: 2,
        },
      }}
    />
  )
}
