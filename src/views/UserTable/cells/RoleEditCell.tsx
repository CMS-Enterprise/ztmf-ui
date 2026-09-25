import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import { GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid'
import { colors } from '@/theme/tokens'
import { ROLE_DESCRIPTOR } from '../helpers'

/** Props for {@link RoleEditCell}. */
export type RoleEditCellProps = GridRenderEditCellParams & {
  /** Role values+labels the actor may assign (gated by selectableRoles). */
  options: { value: string; label: string }[]
}

/**
 * Edit cell for the Role column. Shows the native singleSelect dropdown with
 * the short descriptor line underneath, updating live as the user picks a
 * role so the inline edit row mirrors the read view's stacked layout.
 *
 * Commits via the grid apiRef so the new value is picked up by
 * processRowUpdate when the row is saved.
 * @param {RoleEditCellProps} props - DataGrid edit cell props plus the list
 *   of role options the current actor may grant.
 * @returns {JSX.Element} The role edit cell.
 */
export default function RoleEditCell({ options, ...props }: RoleEditCellProps) {
  const { id, value } = props
  const apiRef = useGridApiContext()
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        width: '100%',
        // Match the cell padding the DataGrid strips in edit mode.
        px: 2.25,
        py: 1,
      }}
    >
      <TextField
        select
        size="small"
        value={value ?? ''}
        onChange={(e) =>
          apiRef.current.setEditCellValue({
            id,
            field: 'role',
            value: e.target.value,
          })
        }
        sx={{
          '& .MuiInputBase-root': { height: 30, fontSize: 13 },
          '& .MuiSelect-select': {
            py: 0,
            pl: 1.5,
            display: 'flex',
            alignItems: 'center',
            height: '30px !important',
            boxSizing: 'border-box',
          },
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
      <Typography sx={{ fontSize: 12, color: colors.neutral500, pl: 0.5 }}>
        {ROLE_DESCRIPTOR[value as string] ?? ''}
      </Typography>
    </Box>
  )
}
