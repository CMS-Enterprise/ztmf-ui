/**
 * OpDiv settings.
 *
 * Two different backend boundaries meet in this one dialog, so the controls
 * are gated individually rather than by a single "can edit" flag:
 *
 *  - code / name / parent / active / insights go through PUT /opdivs, which is
 *    **OWNER only**;
 *  - the System Delegate switch has its own endpoint, open to **OWNER and
 *    HHS_ADMIN**.
 *
 * So an HHS admin opens this and sees the identity fields as read-only text
 * with only the delegate switch live. Showing them editable and letting the
 * save 403 would be worse than not offering it.
 *
 * @module views/OpDivDashboard/components/EditOpDivModal
 */
import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Modal from '@/components/ui/Modal'
import Field, { fieldInputSx } from '@/components/ui/Field'
import CompactSwitchLabel from '@/components/ui/CompactSwitchLabel'
import TextField from '@mui/material/TextField'
import { useSetOpDivDelegateEnabled } from '@/utils/delegates'
import { useUpdateOpDiv } from '@/utils/opdivs'
import { parseApiError } from '@/utils/apiErrors'
import { isAuthHandled, notify } from '@/utils/notify'
import { colors } from '@/theme/tokens'
import type { OpDiv } from '@/types'

const MAX_CODE = 16
const MAX_NAME = 128

/** Props for {@link EditOpDivModal}. */
export type EditOpDivModalProps = {
  open: boolean
  onClose: () => void
  opdiv: OpDiv
  /** OWNER: may edit identity, active state and insights. */
  canManage: boolean
  /** OWNER or HHS_ADMIN: may flip the System Delegate capability. */
  canToggleDelegate: boolean
  /** Called after the OpDiv is deactivated, so the page can navigate away. */
  onDeactivated?: () => void
}

/**
 * Settings dialog for one OpDiv.
 * @param {EditOpDivModalProps} props - Target OpDiv and per-control gates.
 * @returns {JSX.Element} The modal.
 */
export default function EditOpDivModal({
  open,
  onClose,
  opdiv,
  canManage,
  canToggleDelegate,
  onDeactivated,
}: EditOpDivModalProps) {
  const [code, setCode] = useState(opdiv.code)
  const [name, setName] = useState(opdiv.name)
  const [active, setActive] = useState(opdiv.active)
  const [insights, setInsights] = useState(opdiv.insights_enabled === true)
  const [delegate, setDelegate] = useState(opdiv.system_delegate_enabled)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const updateOpDiv = useUpdateOpDiv()
  const setDelegateEnabled = useSetOpDivDelegateEnabled()

  // Seed on open and on a change of OpDiv only: a refetch of the same OpDiv
  // mid-save must not revert typed values or wipe a returned field error.
  const seededFor = useRef<number | null>(null)
  useEffect(() => {
    if (!open) {
      seededFor.current = null
      return
    }
    if (seededFor.current === opdiv.opdiv_id) return
    seededFor.current = opdiv.opdiv_id
    setCode(opdiv.code)
    setName(opdiv.name)
    setActive(opdiv.active)
    setInsights(opdiv.insights_enabled === true)
    setDelegate(opdiv.system_delegate_enabled)
    setFieldErrors({})
  }, [open, opdiv])

  const saving = updateOpDiv.isPending || setDelegateEnabled.isPending

  const handleSave = async () => {
    setFieldErrors({})
    const deactivated = canManage && opdiv.active && !active
    const delegateChanged =
      canToggleDelegate && delegate !== opdiv.system_delegate_enabled
    try {
      // Identity first: it is the call that can fail validation, and nothing
      // has been committed if it does.
      if (canManage) {
        await updateOpDiv.mutateAsync({
          opdivId: opdiv.opdiv_id,
          input: {
            code: code.trim(),
            name: name.trim(),
            is_parent: opdiv.is_parent,
            active,
            insights_enabled: insights,
          },
        })
      }
    } catch (error) {
      if (isAuthHandled(error)) return
      const parsed = parseApiError(error)
      if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors(parsed.fieldErrors)
        return
      }
      notify(parsed.message, 'error')
      return
    }
    // The delegate capability has its own endpoint with a wider gate, so it
    // is sent separately and only when it actually changed.
    if (delegateChanged) {
      try {
        await setDelegateEnabled.mutateAsync({
          opdivId: opdiv.opdiv_id,
          enabled: delegate,
        })
      } catch (error) {
        if (isAuthHandled(error)) return
        const { message } = parseApiError(error)
        if (!canManage) {
          notify(message, 'error')
          return
        }
        notify(
          `Saved code, name, Insights and Active, but not the System Delegate change: ${message}`,
          'error'
        )
      }
    }
    onClose()
    if (deactivated) onDeactivated?.()
  }

  const readOnlyLine = (label: string, value: string) => (
    <Box>
      <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>
        {value}
      </Typography>
    </Box>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${opdiv.code} settings`}
      size="md"
      disableBackdropClose
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving || (!canManage && !canToggleDelegate)}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {canManage ? (
          <>
            <Field id="opdiv-code" label="Code" error={fieldErrors.code}>
              <TextField
                id="opdiv-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputProps={{ maxLength: MAX_CODE }}
                error={Boolean(fieldErrors.code)}
                sx={fieldInputSx}
                fullWidth
              />
            </Field>
            <Field id="opdiv-name" label="Name" error={fieldErrors.name}>
              <TextField
                id="opdiv-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                inputProps={{ maxLength: MAX_NAME }}
                error={Boolean(fieldErrors.name)}
                sx={fieldInputSx}
                fullWidth
              />
            </Field>
          </>
        ) : (
          <>
            {readOnlyLine('Code', opdiv.code)}
            {readOnlyLine('Name', opdiv.name)}
            <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
              Renaming an OpDiv is restricted to platform owners.
            </Typography>
          </>
        )}

        <CompactSwitchLabel
          label="System Delegate role"
          checked={delegate}
          onChange={setDelegate}
          disabled={!canToggleDelegate}
        />

        {canManage && (
          <>
            <CompactSwitchLabel
              label="ZTMF Insights"
              checked={insights}
              onChange={setInsights}
            />
            <CompactSwitchLabel
              label="Active"
              checked={active}
              onChange={setActive}
            />
            {opdiv.active && !active && (
              <Typography sx={{ fontSize: 12, color: colors.down }}>
                Deactivating hides this OpDiv from assignment and from the OpDiv
                switcher. Its systems and scores are unaffected.
              </Typography>
            )}
          </>
        )}
      </Box>
    </Modal>
  )
}
