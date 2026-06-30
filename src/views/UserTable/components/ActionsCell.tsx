import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { colors } from '@/theme/tokens'

/** Props for {@link ActionsCell}. */
export type ActionsCellProps = {
  /** Enter inline-edit mode on this row. */
  onEdit: () => void
  /** Open the Assign FISMA systems modal scoped to this user. */
  onAssignSystems: () => void
  /** Open the Assign OpDivs modal scoped to this user. */
  onAssignOpDivs: () => void
  /** Open the delete-confirmation dialog for this row. */
  onDelete: () => void
  /**
   * True when this row represents the signed-in user themselves. Hides
   * the Delete button so the actor can't deactivate their own account
   * (the backend rejects self-delete too; this is just a UI guard).
   */
  isSelf?: boolean
}

/**
 * Read-mode actions cell for an active user row: Edit, an overflow menu
 * (Assign FISMA systems / Assign OpDivs), and Delete - three icon buttons
 * that mirror the Dashboard row-actions layout.
 *
 * Built by hand instead of using the DataGrid's `type: 'actions'` cell so
 * every icon button can be wrapped in a Tooltip (the auto-generated kebab
 * trigger from `showInMenu` exposes no tooltip slot) and so the broken
 * MUI column-header filter popup never gets a chance to render against the
 * CMS DSG global styles.
 * @param {ActionsCellProps} props - Per-row callbacks.
 * @returns {JSX.Element} The right-aligned icon row with a popover menu.
 */
export default function ActionsCell({
  onEdit,
  onAssignSystems,
  onAssignOpDivs,
  onDelete,
  isSelf = false,
}: ActionsCellProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = Boolean(anchor)
  const closeMenu = () => setAnchor(null)
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 0.5,
        width: '100%',
      }}
    >
      <Tooltip title="Edit user">
        <IconButton size="small" onClick={onEdit} aria-label="Edit user">
          <EditIcon fontSize="small" sx={{ color: colors.neutral700 }} />
        </IconButton>
      </Tooltip>
      {!isSelf && (
        <Tooltip title="Delete user">
          <IconButton size="small" onClick={onDelete} aria-label="Delete user">
            <DeleteIcon fontSize="small" sx={{ color: colors.neutral700 }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="More actions">
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={open || undefined}
        >
          <MoreHorizIcon fontSize="small" sx={{ color: colors.neutral700 }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            closeMenu()
            onAssignSystems()
          }}
        >
          Assign FISMA systems
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu()
            onAssignOpDivs()
          }}
        >
          Assign OpDivs
        </MenuItem>
      </Menu>
    </Box>
  )
}
