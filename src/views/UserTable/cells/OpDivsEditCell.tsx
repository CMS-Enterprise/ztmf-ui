import { useState } from 'react'
import Box from '@mui/material/Box'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import CloseIcon from '@mui/icons-material/Close'
import { GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid'
import { colors, radius } from '@/theme/tokens'
import type { OpDiv } from '@/types'

/** Props for {@link OpDivsEditCell}. */
export type OpDivsEditCellProps = GridRenderEditCellParams & {
  /** All OpDivs the actor may grant; rendered minus ids already selected. */
  opdivOptions: OpDiv[]
  /** Stable opdiv_id -> code map for chip rendering. */
  opdivCodeMap: Record<number, string>
}

/**
 * Inline OpDivs editor used on new rows of the Users table.
 *
 * Renders each selected code as a chip with a remove button, plus a
 * dashed "+ Add" pill that opens a menu of the OpDivs not yet selected.
 * Selection is row-local: changes write the id list into the grid's
 * `opdivs` edit value via the apiRef, and processRowUpdate commits the
 * whole set in one batch PUT after the user row is created. Nothing
 * touches the backend until the row is saved.
 * @param {OpDivsEditCellProps} props - DataGrid edit cell props plus the
 *   assignable OpDiv options and code map.
 * @returns {JSX.Element} The OpDivs edit cell.
 */
export default function OpDivsEditCell({
  id,
  field,
  value,
  opdivOptions,
  opdivCodeMap,
}: OpDivsEditCellProps) {
  const apiRef = useGridApiContext()
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null)
  const ids = (value as number[] | undefined) ?? []
  const selected = new Set(ids)
  const available = opdivOptions.filter((od) => !selected.has(od.opdiv_id))

  const commit = (next: number[]) => {
    apiRef.current.setEditCellValue({ id, field, value: next })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'wrap',
        px: 2.25,
        py: 1,
        width: '100%',
      }}
    >
      {ids.map((opdivId) => (
        <Box
          key={opdivId}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            pl: 1,
            pr: 0.5,
            py: 0.375,
            borderRadius: `${radius.sm}px`,
            backgroundColor: colors.primary50,
            color: colors.ink900,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {opdivCodeMap[opdivId] ?? opdivId}
          <Box
            component="button"
            type="button"
            aria-label={`Remove ${opdivCodeMap[opdivId] ?? opdivId}`}
            onClick={() => commit(ids.filter((i) => i !== opdivId))}
            sx={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              p: 0,
              ml: 0.25,
              display: 'inline-flex',
              alignItems: 'center',
              color: colors.ink900,
              opacity: 0.6,
              '&:hover': { opacity: 1 },
            }}
          >
            <CloseIcon sx={{ fontSize: 12 }} />
          </Box>
        </Box>
      ))}
      {available.length > 0 && (
        <>
          <Box
            component="button"
            type="button"
            onClick={(e) => setAddAnchor(e.currentTarget)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              px: 1,
              py: 0.375,
              borderRadius: `${radius.sm}px`,
              border: `1px dashed ${colors.neutral400}`,
              background: 'transparent',
              cursor: 'pointer',
              color: colors.neutral500,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            + Add
          </Box>
          <Menu
            anchorEl={addAnchor}
            open={Boolean(addAnchor)}
            onClose={() => setAddAnchor(null)}
          >
            {available.map((od) => (
              <MenuItem
                key={od.opdiv_id}
                onClick={() => {
                  setAddAnchor(null)
                  commit([...ids, od.opdiv_id])
                }}
              >
                {od.code}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  )
}
