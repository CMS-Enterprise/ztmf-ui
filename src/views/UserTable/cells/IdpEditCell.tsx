import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import { GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid'
import { colors } from '@/theme/tokens'

/**
 * Edit cell for the identity_provider column - a Select with Okta / Entra.
 * The new value is committed via the grid apiRef and picked up by
 * processRowUpdate when the row is saved.
 *
 * Reads the raw row value (not props.value) because the column's
 * valueGetter returns the display label "Okta", which would not match the
 * lowercase MenuItem values. Also lowercases the rendered value
 * defensively so an upstream display-cased label still maps to the right
 * option.
 * @param {GridRenderEditCellParams} props - Standard DataGrid edit cell props.
 * @returns {JSX.Element} The identity provider edit cell.
 */
export default function IdpEditCell(props: GridRenderEditCellParams) {
  const { id, row } = props
  const apiRef = useGridApiContext()
  const value = (row.identity_provider as string | undefined) ?? ''
  return (
    <Box sx={{ px: 2.25, py: 1, width: '100%' }}>
      <TextField
        select
        size="small"
        value={value}
        onChange={(e) =>
          apiRef.current.setEditCellValue({
            id,
            field: 'identity_provider',
            value: e.target.value,
          })
        }
        fullWidth
        SelectProps={{
          displayEmpty: true,
          renderValue: (selected) => {
            const v = ((selected as string | undefined) ?? '').toLowerCase()
            if (v === 'okta') return 'Okta'
            if (v === 'entra') return 'Entra'
            return (
              <Box
                component="span"
                sx={{ color: colors.neutral500, fontSize: 13 }}
              >
                Select identity provider
              </Box>
            )
          },
        }}
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
        <MenuItem value="okta">Okta</MenuItem>
        <MenuItem value="entra">Entra</MenuItem>
      </TextField>
    </Box>
  )
}
