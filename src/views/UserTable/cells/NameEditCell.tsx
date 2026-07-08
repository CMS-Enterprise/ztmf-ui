import * as React from 'react'
import Box from '@mui/material/Box'
import InputBase from '@mui/material/InputBase'
import { GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid'
import { colors, radius } from '@/theme/tokens'
import { avatarColor, initialsFor } from '../helpers'

/**
 * Edit cell for the Name column of the Users table. Renders the user's
 * deterministic avatar circle alongside stacked Name and Email inputs
 * (the email lives in a hidden column on the grid, edited here via the
 * apiRef so row-edit mode commits both fields together). Auto-focuses the
 * name input on entering edit mode.
 * @param {GridRenderEditCellParams} props - Standard DataGrid edit cell props.
 * @returns {JSX.Element} The inline name+email edit cell.
 */
export default function NameEditCell(props: GridRenderEditCellParams) {
  const { id, value, row } = props
  const apiRef = useGridApiContext()
  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    apiRef.current.setEditCellValue({
      id,
      field: 'fullname',
      value: e.target.value,
    })
  }
  const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    apiRef.current.setEditCellValue({
      id,
      field: 'email',
      value: e.target.value,
    })
  }
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        // DataGrid strips its 18px cell padding in edit mode; add it back so
        // the inputs aren't flush against the row's left edge.
        px: 2.25,
        py: 1,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: avatarColor(String(row.userid)),
          color: colors.white,
          fontSize: 12,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initialsFor(row.fullname, row.email)}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          flex: 1,
          minWidth: 0,
        }}
      >
        <InputBase
          // Auto-focus the first input on inline edit (only fires on explicit
          // user-triggered edit mode, matching the previous EditInputCell).
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder="Full name"
          value={value ?? ''}
          onChange={onNameChange}
          sx={{
            fontSize: 13,
            fontWeight: 500,
            height: 28,
            px: 1,
            border: `1px solid ${colors.border}`,
            borderRadius: `${radius.sm}px`,
            backgroundColor: colors.white,
          }}
        />
        <InputBase
          placeholder="Email"
          value={row.email ?? ''}
          onChange={onEmailChange}
          sx={{
            fontSize: 12,
            fontWeight: 500,
            height: 26,
            px: 1,
            border: `1px solid ${colors.border}`,
            borderRadius: `${radius.sm}px`,
            backgroundColor: colors.white,
          }}
        />
      </Box>
    </Box>
  )
}
