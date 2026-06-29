import { useState } from 'react'
import Box from '@mui/material/Box'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import CloseIcon from '@mui/icons-material/Close'
import { colors, radius } from '@/theme/tokens'
import type { OpDiv } from '@/types'

/** Props for {@link OpDivsEditCell}. */
export type OpDivsEditCellProps = {
  /** User the cell is for. */
  userid: string
  /** OpDiv ids currently granted to the user. */
  ids: number[]
  /** All OpDivs the actor may grant; rendered minus ids already granted. */
  opdivOptions: OpDiv[]
  /** Stable opdiv_id -> code map for chip rendering. */
  opdivCodeMap: Record<number, string>
  /** Eager grant. Resolves after the server confirms. */
  onGrant: (userid: string, opdivId: number) => Promise<void>
  /** Eager revoke. Resolves after the server confirms. */
  onRevoke: (userid: string, opdivId: number) => Promise<void>
}

/**
 * Inline OpDivs editor used in row-edit mode of the Users table.
 *
 * Renders each granted code as a chip with a × remove button, plus a
 * dashed "+ Add" pill that opens a menu of the OpDivs the user does not
 * yet hold. Grants and revokes commit eagerly via the same grantOpDiv /
 * revokeOpDiv helpers the OpDivGrantModal uses; the user's row state stays
 * in sync independent of the surrounding row-save flow.
 * @param {OpDivsEditCellProps} props - Component props.
 * @returns {JSX.Element} The OpDivs edit cell.
 */
export default function OpDivsEditCell({
  userid,
  ids,
  opdivOptions,
  opdivCodeMap,
  onGrant,
  onRevoke,
}: OpDivsEditCellProps) {
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null)
  const granted = new Set(ids)
  const available = opdivOptions.filter((od) => !granted.has(od.opdiv_id))
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
      {ids.map((id) => (
        <Box
          key={id}
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
          {opdivCodeMap[id] ?? id}
          <Box
            component="button"
            type="button"
            aria-label={`Remove ${opdivCodeMap[id] ?? id}`}
            onClick={() => onRevoke(userid, id)}
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
                onClick={async () => {
                  setAddAnchor(null)
                  await onGrant(userid, od.opdiv_id)
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
