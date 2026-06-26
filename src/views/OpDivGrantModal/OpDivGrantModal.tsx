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
import { fetchUserOpDivs, setUserOpDivs } from '@/utils/userOpdivs'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import type { OpDiv } from '@/types'

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
  /**
   * Fired after a successful save so the caller can refresh the user's row
   * (grants + derived identity_provider) against post-mutation server state.
   */
  onChanged?: (userid: string) => void
}

export default function OpDivGrantModal({
  open,
  handleClose,
  userid,
  userName,
  opdivOptions,
  onChanged,
}: Props) {
  const [localOpDivs, setLocalOpDivs] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)

  const opdivMap = React.useMemo(() => {
    const map: Record<number, { code: string; name: string }> = {}
    for (const od of opdivOptions) {
      map[od.opdiv_id] = { code: od.code, name: od.name }
    }
    return map
  }, [opdivOptions])

  const sortedOptionIds = React.useMemo(
    () =>
      opdivOptions
        .map((od) => od.opdiv_id)
        .sort((a, b) =>
          (opdivMap[a]?.code || '').localeCompare(opdivMap[b]?.code || '')
        ),
    [opdivOptions, opdivMap]
  )

  const handleError = (error: unknown) => {
    if (isAuthHandled(error)) return
    const parsed = parseApiError(error)
    notify(parsed.message, 'error')
  }

  React.useEffect(() => {
    if (open && userid) {
      fetchUserOpDivs(String(userid))
        .then((grants) => setLocalOpDivs(grants))
        .catch((error) => handleError(error))
    }
  }, [open, userid])

  const optionLabel = (opdivId: number) => {
    const od = opdivMap[opdivId]
    return od ? `${od.code} - ${od.name}` : ''
  }

  const handleSave = () => {
    setSaving(true)
    // An OPDIV_ADMIN's scope is already encoded in sortedOptionIds (only their
    // own OpDivs appear as options). Filter localOpDivs to that set so the
    // batch request never includes out-of-scope IDs the target user holds from
    // another admin — the backend scope gate rejects any desired set that
    // contains an ID the caller doesn't hold, even if they didn't add it.
    const scopedIds = localOpDivs.filter((id) => sortedOptionIds.includes(id))
    setUserOpDivs(String(userid), scopedIds)
      .then(() => {
        notify('Saved', 'success')
        onChanged?.(String(userid))
        handleClose()
      })
      .catch((error) => handleError(error))
      .finally(() => setSaving(false))
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      aria-label={`Assign OpDivs for ${userName}`}
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
          options={sortedOptionIds}
          disableClearable
          getOptionLabel={optionLabel}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option}>
              <Checkbox style={{ marginRight: 8 }} checked={selected} />
              {optionLabel(option)}
            </li>
          )}
          value={localOpDivs}
          onChange={(_event, newValue) => setLocalOpDivs(newValue)}
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
        <CmsButton onClick={handleClose} variation="ghost">
          Cancel
        </CmsButton>
        <CmsButton onClick={handleSave} disabled={saving}>
          Save
        </CmsButton>
      </DialogActions>
    </Dialog>
  )
}
