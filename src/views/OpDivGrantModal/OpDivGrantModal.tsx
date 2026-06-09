import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { GridRowId } from '@mui/x-data-grid'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import { fetchUserOpDivs, grantOpDiv, revokeOpDiv } from '@/utils/userOpdivs'
import { parseApiError } from '@/utils/apiErrors'
import type { OpDiv } from '@/types'

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

type Props = {
  open: boolean
  handleClose: () => void
  userid: GridRowId
  userName: string
  /**
   * Assignable OpDivs, already scoped by the caller (children only, active,
   * and - for an OPDIV_ADMIN actor - limited to their own OpDivs). The modal
   * does not re-scope; it renders exactly what it is given.
   */
  opdivOptions: OpDiv[]
}

const SNACK_ANCHOR = { vertical: 'top', horizontal: 'left' } as const

export default function OpDivGrantModal({
  open,
  handleClose,
  userid,
  userName,
  opdivOptions,
}: Props) {
  const [assignedOpDivs, setAssignedOpDivs] = React.useState<number[]>([])
  const [pendingRevoke, setPendingRevoke] = React.useState<{
    opdivId: number
    nextValue: number[]
  } | null>(null)
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()

  const opdivMap = React.useMemo(() => {
    const map: Record<number, { code: string; name: string }> = {}
    for (const od of opdivOptions) {
      map[od.opdiv_id] = { code: od.code, name: od.name }
    }
    return map
  }, [opdivOptions])

  React.useEffect(() => {
    if (open && userid) {
      fetchUserOpDivs(String(userid))
        .then((grants) => setAssignedOpDivs(grants))
        .catch((error) => handleError(error))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userid])

  const handleError = (error: unknown) => {
    const parsed = parseApiError(error)
    if (parsed.status === 401) {
      navigate(Routes.SIGNIN, {
        replace: true,
        state: { message: ERROR_MESSAGES.error },
      })
      return
    }
    enqueueSnackbar(parsed.message, {
      variant: 'error',
      anchorOrigin: SNACK_ANCHOR,
      autoHideDuration: 1500,
    })
  }

  const handleConfirmRevoke = (confirm: boolean) => {
    const target = pendingRevoke
    setPendingRevoke(null)
    if (!confirm || !target) return
    revokeOpDiv(String(userid), target.opdivId)
      .then(() => {
        setAssignedOpDivs(target.nextValue)
        enqueueSnackbar('Saved - revoked OpDiv', {
          variant: 'success',
          anchorOrigin: SNACK_ANCHOR,
        })
      })
      .catch((error) => handleError(error))
  }

  const optionLabel = (opdivId: number) => {
    const od = opdivMap[opdivId]
    return od ? `${od.code} - ${od.name}` : ''
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        aria-label="Assign OpDivs"
      >
        <DialogTitle align="center">
          <div>
            <Typography variant="h3">Assign OpDivs</Typography>
          </div>
        </DialogTitle>
        <DialogContent sx={{ height: 500 }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            limitTags={3}
            options={opdivOptions
              .map((od) => od.opdiv_id)
              .slice()
              .sort((a, b) =>
                (opdivMap[a]?.code || '').localeCompare(opdivMap[b]?.code || '')
              )}
            disableClearable
            getOptionLabel={optionLabel}
            renderOption={(props, option, { selected }) => {
              const isAssigned = assignedOpDivs.includes(option)
              return (
                <li {...props} key={option}>
                  <Checkbox
                    icon={icon}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected || isAssigned}
                    disabled={isAssigned}
                  />
                  {optionLabel(option)}
                </li>
              )
            }}
            value={assignedOpDivs}
            onChange={(_event, newValue) => {
              const added = newValue.filter(
                (item) => !assignedOpDivs.includes(item)
              )
              const removed = assignedOpDivs.filter(
                (item) => !newValue.includes(item)
              )
              if (added.length) {
                grantOpDiv(String(userid), added[0])
                  .then(() => {
                    setAssignedOpDivs(newValue)
                    enqueueSnackbar('Saved - granted OpDiv', {
                      variant: 'success',
                      anchorOrigin: SNACK_ANCHOR,
                    })
                  })
                  .catch((error) => handleError(error))
              } else if (removed.length) {
                setPendingRevoke({ opdivId: removed[0], nextValue: newValue })
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assign OpDivs"
                variant="filled"
                placeholder="OpDivs"
                InputLabelProps={{ sx: { marginTop: 0 } }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={handleClose}>Close</CmsButton>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        title="Confirm Revoke OpDiv"
        confirmationText={
          pendingRevoke
            ? `Are you sure you want to revoke ${
                optionLabel(pendingRevoke.opdivId) || 'this OpDiv'
              } from ${userName || 'this user'}?`
            : ''
        }
        open={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        confirmClick={handleConfirmRevoke}
        confirmLabel="Revoke"
      />
    </>
  )
}
