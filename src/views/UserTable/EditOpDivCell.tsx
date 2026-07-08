import * as React from 'react'
import { GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid'
import { Autocomplete, Checkbox, TextField } from '@mui/material'
import { OpDiv } from '@/types'

interface EditOpDivCellProps extends GridRenderEditCellParams {
  opdivOptions: OpDiv[]
}

export default function EditOpDivCell(props: EditOpDivCellProps) {
  const { id, value, field, opdivOptions } = props
  const apiRef = useGridApiContext()

  const selectedIds = (value as number[] | undefined) ?? []
  const selectedOptions = opdivOptions.filter((od) =>
    selectedIds.includes(od.opdiv_id)
  )

  const handleChange = (_: React.SyntheticEvent, newValue: OpDiv[]) => {
    apiRef.current.setEditCellValue({
      id,
      field,
      value: newValue.map((od) => od.opdiv_id),
    })
  }

  return (
    <Autocomplete
      multiple
      size="small"
      options={opdivOptions}
      getOptionLabel={(od) => od.code}
      value={selectedOptions}
      onChange={handleChange}
      disableCloseOnSelect
      disablePortal
      limitTags={2}
      renderOption={(props, option, { selected }) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <Checkbox checked={selected} size="small" sx={{ mr: 0.5 }} />
            {option.code}
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          variant="standard"
          sx={{
            '& .MuiInput-underline:before': { border: 'none' },
            '& .MuiInput-underline:after': { border: 'none' },
            '& .MuiInput-underline:hover:before': { border: 'none !important' },
          }}
        />
      )}
      sx={{ width: '100%' }}
    />
  )
}
